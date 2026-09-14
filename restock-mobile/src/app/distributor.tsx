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

const API_URL = 'https://restock-backend-zkrx.onrender.com/api';

export default function DistributorScreen() {
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ total: 0, pending: 0, confirmed: 0, delivered: 0 });
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    loadUser();
    loadOrders();
  }, []);

  const loadUser = async () => {
    const userData = await AsyncStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  };

  const loadOrders = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_URL}/orders`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      
      if (data.success) {
        setOrders(data.orders || []);
        const total = data.orders.length;
        const pending = data.orders.filter(o => o.status === 'pending').length;
        const confirmed = data.orders.filter(o => o.status === 'confirmed').length;
        const delivered = data.orders.filter(o => o.status === 'delivered').length;
        setStats({ total, pending, confirmed, delivered });
      }
    } catch (error) {
      console.error('Error loading orders:', error);
      Alert.alert('Error', 'Failed to load orders');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    router.replace('/');
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadOrders();
  };

  const showProducts = () => {
    const productNames = orders.reduce((acc, order) => {
      (order.items || []).forEach(item => {
        if (!acc.includes(item.productName)) {
          acc.push(item.productName);
        }
      });
      return acc;
    }, []);

    Alert.alert(
      '📦 Your Products',
      productNames.length > 0 
        ? productNames.slice(0, 10).join('\n') 
        : 'No products in recent orders.'
    );
  };

  const showAnalytics = () => {
    const total = orders.length;
    const delivered = orders.filter(o => o.status === 'delivered').length;
    const revenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
    
    Alert.alert(
      '📊 Your Analytics',
      `📦 Total Orders: ${total}\n` +
      `✅ Delivered: ${delivered}\n` +
      `⏳ Pending: ${orders.filter(o => o.status === 'pending').length}\n` +
      `💰 Total Revenue: ₦${revenue.toLocaleString()}`
    );
  };

  const showPayments = () => {
    const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
    const pendingPayments = orders
      .filter(o => o.status === 'pending' || o.status === 'confirmed')
      .reduce((sum, o) => sum + (o.total || 0), 0);
    
    Alert.alert(
      '💰 Payments Summary',
      `✅ Paid: ₦${(totalRevenue - pendingPayments).toLocaleString()}\n` +
      `⏳ Pending: ₦${pendingPayments.toLocaleString()}\n` +
      `📊 Total: ₦${totalRevenue.toLocaleString()}`
    );
  };

  const renderDashboard = () => (
    <>
      <Text style={styles.title}>📦 Distributor Dashboard</Text>
      <Text style={styles.subtitle}>Manage orders and inventory.</Text>

      {/* Stats Cards */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total Orders</Text>
        </View>
        <View style={[styles.statCard, styles.pendingCard]}>
          <Text style={styles.statNumber}>{stats.pending}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={[styles.statCard, styles.confirmedCard]}>
          <Text style={styles.statNumber}>{stats.confirmed}</Text>
          <Text style={styles.statLabel}>Confirmed</Text>
        </View>
        <View style={[styles.statCard, styles.deliveredCard]}>
          <Text style={styles.statNumber}>{stats.delivered}</Text>
          <Text style={styles.statLabel}>Delivered</Text>
        </View>
      </View>

      {/* Quick Actions Grid */}
      <View style={styles.grid}>
        <TouchableOpacity style={styles.card} onPress={showProducts}>
          <Text style={styles.cardIcon}>📦</Text>
          <Text style={styles.cardTitle}>Products</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.card} onPress={showAnalytics}>
          <Text style={styles.cardIcon}>📊</Text>
          <Text style={styles.cardTitle}>Analytics</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.card} onPress={showPayments}>
          <Text style={styles.cardIcon}>💰</Text>
          <Text style={styles.cardTitle}>Payments</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.card} onPress={() => setActiveTab('settings')}>
          <Text style={styles.cardIcon}>⚙️</Text>
          <Text style={styles.cardTitle}>Settings</Text>
        </TouchableOpacity>
      </View>

      {/* Recent Orders */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🆕 Recent Orders</Text>
        {loading ? (
          <ActivityIndicator size="large" color="#01311F" style={styles.loader} />
        ) : orders.length === 0 ? (
          <Text style={styles.emptyText}>No orders yet.</Text>
        ) : (
          orders.slice(0, 5).map((order, index) => (
            <View key={index} style={styles.orderItem}>
              <Text style={styles.orderId}>#{order._id.slice(-6).toUpperCase()}</Text>
              <Text style={styles.orderStatus}>{order.status?.toUpperCase()}</Text>
              <Text style={styles.orderTotal}>₦{order.total?.toLocaleString()}</Text>
            </View>
          ))
        )}
      </View>
    </>
  );

  const renderSettings = () => (
    <>
      <Text style={styles.title}>⚙️ Settings</Text>
      <Text style={styles.subtitle}>Manage your account preferences.</Text>

      <TouchableOpacity style={styles.settingsItem} onPress={() => Alert.alert('Profile', 'Profile settings coming soon!')}>
        <Text style={styles.settingsIcon}>👤</Text>
        <View style={styles.settingsText}>
          <Text style={styles.settingsTitle}>Profile Settings</Text>
          <Text style={styles.settingsSubtitle}>Update your business information</Text>
        </View>
        <Text style={styles.settingsArrow}>→</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.settingsItem} onPress={() => Alert.alert('Address', 'Address settings coming soon!')}>
        <Text style={styles.settingsIcon}>📍</Text>
        <View style={styles.settingsText}>
          <Text style={styles.settingsTitle}>Address Settings</Text>
          <Text style={styles.settingsSubtitle}>Update your pickup address</Text>
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

      <TouchableOpacity style={styles.settingsItem} onPress={() => Alert.alert('Bank', 'Bank details settings coming soon!')}>
        <Text style={styles.settingsIcon}>💰</Text>
        <View style={styles.settingsText}>
          <Text style={styles.settingsTitle}>Bank Details</Text>
          <Text style={styles.settingsSubtitle}>Manage your payment information</Text>
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
        <Text style={styles.welcome}>Hello, {user?.name || 'Distributor'}! 👋</Text>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>🚪</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {activeTab === 'dashboard' ? renderDashboard() : renderSettings()}
      </ScrollView>

      {/* Bottom Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity 
          style={[styles.tabItem, activeTab === 'dashboard' && styles.tabItemActive]}
          onPress={() => setActiveTab('dashboard')}
        >
          <Text style={styles.tabIcon}>📊</Text>
          <Text style={[styles.tabLabel, activeTab === 'dashboard' && styles.tabLabelActive]}>
            Dashboard
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tabItem, activeTab === 'settings' && styles.tabItemActive]}
          onPress={() => setActiveTab('settings')}
        >
          <Text style={styles.tabIcon}>⚙️</Text>
          <Text style={[styles.tabLabel, activeTab === 'settings' && styles.tabLabelActive]}>
            Settings
          </Text>
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
  confirmed: '#0D47A1',
  delivered: '#1B5E20',
  danger: '#E17055',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  welcome: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
  },
  logoutButton: {
    padding: 8,
  },
  logoutText: {
    fontSize: 24,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.primary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.gray,
    marginBottom: 24,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  pendingCard: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.pending,
  },
  confirmedCard: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.confirmed,
  },
  deliveredCard: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.delivered,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.primary,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  card: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: COLORS.white,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  section: {
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: COLORS.primary,
  },
  loader: {
    marginVertical: 20,
  },
  orderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  orderId: {
    fontSize: 14,
    fontWeight: '600',
  },
  orderStatus: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: COLORS.lightGray,
  },
  orderTotal: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  emptyText: {
    color: COLORS.gray,
    textAlign: 'center',
    padding: 20,
  },
  // Settings styles
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  dangerItem: {
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  settingsIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  settingsText: {
    flex: 1,
  },
  settingsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
  },
  settingsSubtitle: {
    fontSize: 13,
    color: COLORS.gray,
    marginTop: 2,
  },
  settingsArrow: {
    fontSize: 20,
    color: COLORS.gray,
  },
  dangerText: {
    color: COLORS.danger,
  },
  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
    paddingVertical: 8,
    paddingBottom: 20,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  tabItemActive: {
    borderTopWidth: 3,
    borderTopColor: COLORS.primary,
    marginTop: -11,
  },
  tabIcon: {
    fontSize: 24,
  },
  tabLabel: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 4,
  },
  tabLabelActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
});