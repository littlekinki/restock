import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import * as Location from 'expo-location';

const API_URL = 'https://restock-backend-zkrx.onrender.com/api';

const BANK_DETAILS = {
  bankName: process.env.EXPO_PUBLIC_BANK_NAME || 'Palmpay',
  accountNumber: process.env.EXPO_PUBLIC_BANK_ACCOUNT || '7046835216',
  accountName: process.env.EXPO_PUBLIC_BANK_ACCOUNT_NAME || 'Kingsley Mamah .O.',
};

export default function RiderScreen() {
  const [user, setUser] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState({ total: 0, pending: 0, completed: 0 });

  useEffect(() => {
    loadUser();
    loadDeliveries();
    startLocationUpdates();
  }, []);

  const loadUser = async () => {
    const userData = await AsyncStorage.getItem('user');
    if (userData) setUser(JSON.parse(userData));
  };

  const loadDeliveries = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const userData = await AsyncStorage.getItem('user');
      const currentUser = JSON.parse(userData);
      const response = await fetch(`${API_URL}/orders?riderId=${currentUser?.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setDeliveries(data.orders || []);
        const total = data.orders.length;
        const pending = data.orders.filter(o => o.status === 'picked_up' || o.status === 'out_for_delivery').length;
        const completed = data.orders.filter(o => o.status === 'delivered').length;
        setStats({ total, pending, completed });
      }
    } catch (error) {
      console.error('Error loading deliveries:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const updateLocation = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({});
      const token = await AsyncStorage.getItem('token');
      await fetch(`${API_URL}/riders/${user?.id}/location`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: location.coords.latitude, lng: location.coords.longitude }),
      });
    } catch (error) {
      console.error('Error updating location:', error);
    }
  };

  const startLocationUpdates = () => {
    const interval = setInterval(() => { if (user?.id) updateLocation(); }, 10000);
    return () => clearInterval(interval);
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    router.replace('/');
  };

  const onRefresh = () => { setRefreshing(true); loadDeliveries(); };

  const showDeliveryDetails = (delivery) => {
    const deliveryAddress = delivery.shopId?.address;
    const pickupAddress = delivery.distributorId?.address;
    Alert.alert(
      '📍 Delivery Details',
      `📦 Order #${delivery._id.slice(-6).toUpperCase()}\n\n` +
      `📥 Pickup from:\n${pickupAddress?.street || 'N/A'}\n${pickupAddress?.city || ''}\n\n` +
      `📦 Deliver to:\n${deliveryAddress?.street || 'N/A'}\n${deliveryAddress?.city || ''}\n\n` +
      `💰 Total: ₦${delivery.total?.toLocaleString()}\n\n` +
      `🏦 PAYMENT DETAILS\nBank: ${BANK_DETAILS.bankName}\nAccount: ${BANK_DETAILS.accountNumber}\nName: ${BANK_DETAILS.accountName}`
    );
  };

  const renderDashboard = () => (
    <>
      <Text style={styles.title}>🏍️ Rider Dashboard</Text>
      <Text style={styles.subtitle}>Manage your deliveries.</Text>

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total Deliveries</Text>
        </View>
        <View style={[styles.statCard, styles.pendingCard]}>
          <Text style={styles.statNumber}>{stats.pending}</Text>
          <Text style={styles.statLabel}>In Progress</Text>
        </View>
        <View style={[styles.statCard, styles.completedCard]}>
          <Text style={styles.statNumber}>{stats.completed}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
      </View>

      <View style={styles.grid}>
        <TouchableOpacity style={styles.card} onPress={() => Alert.alert('My Deliveries', `You have ${stats.pending} deliveries in progress`)}>
          <Text style={styles.cardIcon}>📦</Text>
          <Text style={styles.cardTitle}>My Deliveries</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.card} onPress={() => Alert.alert('Earnings', `Total earnings: ₦${user?.earnings?.toLocaleString() || 0}`)}>
          <Text style={styles.cardIcon}>💰</Text>
          <Text style={styles.cardTitle}>Earnings</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📦 Today's Deliveries</Text>
        {loading ? (
          <ActivityIndicator size="large" color="#01311F" style={styles.loader} />
        ) : deliveries.length === 0 ? (
          <Text style={styles.emptyText}>No deliveries assigned.</Text>
        ) : (
          deliveries.slice(0, 5).map((delivery, index) => {
            const deliveryAddress = delivery.shopId?.address;
            const pickupAddress = delivery.distributorId?.address;
            return (
              <TouchableOpacity key={index} style={styles.deliveryItem} onPress={() => showDeliveryDetails(delivery)}>
                <View>
                  <Text style={styles.deliveryId}>#{delivery._id.slice(-6).toUpperCase()}</Text>
                  <Text style={styles.deliveryAddress}>📍 {deliveryAddress?.city || 'Unknown'} → {pickupAddress?.city || 'Unknown'}</Text>
                </View>
                <View style={styles.deliveryRight}>
                  <Text style={styles.deliveryStatus}>{delivery.status?.toUpperCase()}</Text>
                  <Text style={styles.deliveryTotal}>₦{delivery.total?.toLocaleString()}</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>
    </>
  );

  const renderSettings = () => (
    <>
      <Text style={styles.title}>⚙️ Settings</Text>
      <Text style={styles.subtitle}>Manage your rider preferences.</Text>

      <TouchableOpacity style={styles.settingsItem} onPress={() => Alert.alert('Profile', 'Profile settings coming soon!')}>
        <Text style={styles.settingsIcon}>👤</Text>
        <View style={styles.settingsText}>
          <Text style={styles.settingsTitle}>Profile Settings</Text>
          <Text style={styles.settingsSubtitle}>Update your personal information</Text>
        </View>
        <Text style={styles.settingsArrow}>→</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.settingsItem} onPress={() => Alert.alert('Vehicle', 'Vehicle settings coming soon!')}>
        <Text style={styles.settingsIcon}>🏍️</Text>
        <View style={styles.settingsText}>
          <Text style={styles.settingsTitle}>Vehicle Settings</Text>
          <Text style={styles.settingsSubtitle}>Update vehicle type and plate</Text>
        </View>
        <Text style={styles.settingsArrow}>→</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.settingsItem} onPress={() => Alert.alert('Service Area', 'Service area settings coming soon!')}>
        <Text style={styles.settingsIcon}>📍</Text>
        <View style={styles.settingsText}>
          <Text style={styles.settingsTitle}>Service Area</Text>
          <Text style={styles.settingsSubtitle}>Update your operating area</Text>
        </View>
        <Text style={styles.settingsArrow}>→</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.settingsItem} onPress={() => Alert.alert('Bank Details', `Bank: ${BANK_DETAILS.bankName}\nAccount: ${BANK_DETAILS.accountNumber}\nName: ${BANK_DETAILS.accountName}`)}>
        <Text style={styles.settingsIcon}>💰</Text>
        <View style={styles.settingsText}>
          <Text style={styles.settingsTitle}>Bank Details</Text>
          <Text style={styles.settingsSubtitle}>Manage payment information</Text>
        </View>
        <Text style={styles.settingsArrow}>→</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.settingsItem} onPress={() => Alert.alert('Password', 'Password settings coming soon!')}>
        <Text style={styles.settingsIcon}>🔒</Text>
        <View style={styles.settingsText}>
          <Text style={styles.settingsTitle}>Change Password</Text>
          <Text style={styles.settingsSubtitle}>Update your password</Text>
        </View>
        <Text style={styles.settingsArrow}>→</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.settingsItem, styles.dangerItem]} onPress={() => Alert.alert('Warning', 'Account deactivation coming soon!')}>
        <Text style={styles.settingsIcon}>⚠️</Text>
        <View style={styles.settingsText}>
          <Text style={[styles.settingsTitle, styles.dangerText]}>Deactivate Account</Text>
          <Text style={styles.settingsSubtitle}>Permanently disable your account</Text>
        </View>
        <Text style={styles.settingsArrow}>→</Text>
      </TouchableOpacity>
    </>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.welcome}>Hello, {user?.name || 'Rider'}! 👋</Text>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>🚪</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {activeTab === 'dashboard' ? renderDashboard() : renderSettings()}
      </ScrollView>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'dashboard' && styles.tabItemActive]}
          onPress={() => setActiveTab('dashboard')}
        >
          <Text style={styles.tabIcon}>📊</Text>
          <Text style={[styles.tabLabel, activeTab === 'dashboard' && styles.tabLabelActive]}>Dashboard</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'settings' && styles.tabItemActive]}
          onPress={() => setActiveTab('settings')}
        >
          <Text style={styles.tabIcon}>⚙️</Text>
          <Text style={[styles.tabLabel, activeTab === 'settings' && styles.tabLabelActive]}>Settings</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const COLORS = {
  primary: '#01311F',
  primaryDark: '#002B1C',
  secondary: '#4DBE18',
  background: '#FAF8F6',
  white: '#FFFFFF',
  gray: '#6C757D',
  lightGray: '#E9ECEF',
  pending: '#E65100',
  completed: '#1B5E20',
  danger: '#E17055',
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  welcome: { fontSize: 18, fontWeight: '700', color: COLORS.primary },
  logoutButton: { padding: 8 },
  logoutText: { fontSize: 24 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 100 },
  title: { fontSize: 24, fontWeight: '800', color: COLORS.primary, marginBottom: 8 },
  subtitle: { fontSize: 14, color: COLORS.gray, marginBottom: 24 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  statCard: { flex: 1, minWidth: '30%', backgroundColor: COLORS.white, padding: 16, borderRadius: 12, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  pendingCard: { borderLeftWidth: 4, borderLeftColor: COLORS.pending },
  completedCard: { borderLeftWidth: 4, borderLeftColor: COLORS.completed },
  statNumber: { fontSize: 24, fontWeight: '700', color: COLORS.primary },
  statLabel: { fontSize: 12, color: COLORS.gray, marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  card: { flex: 1, minWidth: '45%', backgroundColor: COLORS.white, padding: 20, borderRadius: 12, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardIcon: { fontSize: 32, marginBottom: 8 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: COLORS.primary },
  section: { backgroundColor: COLORS.white, padding: 16, borderRadius: 12, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12, color: COLORS.primary },
  loader: { marginVertical: 20 },
  deliveryItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  deliveryId: { fontSize: 14, fontWeight: '600', color: COLORS.primary },
  deliveryAddress: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  deliveryRight: { alignItems: 'flex-end' },
  deliveryStatus: { fontSize: 12, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, backgroundColor: COLORS.lightGray, marginBottom: 4 },
  deliveryTotal: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  emptyText: { color: COLORS.gray, textAlign: 'center', padding: 20 },
  settingsItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, padding: 16, borderRadius: 12, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  dangerItem: { borderWidth: 1, borderColor: COLORS.danger },
  settingsIcon: { fontSize: 24, marginRight: 16 },
  settingsText: { flex: 1 },
  settingsTitle: { fontSize: 16, fontWeight: '600', color: COLORS.primary },
  settingsSubtitle: { fontSize: 13, color: COLORS.gray, marginTop: 2 },
  settingsArrow: { fontSize: 20, color: COLORS.gray },
  dangerText: { color: COLORS.danger },
  tabBar: { flexDirection: 'row', backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.lightGray, paddingVertical: 8, paddingBottom: 20 },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  tabItemActive: { borderTopWidth: 3, borderTopColor: COLORS.primary, marginTop: -11 },
  tabIcon: { fontSize: 24 },
  tabLabel: { fontSize: 12, color: COLORS.gray, marginTop: 4 },
  tabLabelActive: { color: COLORS.primary, fontWeight: '600' },
});