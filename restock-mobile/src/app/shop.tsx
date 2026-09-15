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
  TextInput,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

const API_URL = 'https://restock-backend-zkrx.onrender.com/api';

export default function ShopScreen() {
  const [user, setUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState({ total: 0, pending: 0, delivered: 0, spent: 0 });

  useEffect(() => {
    loadUser();
    loadProducts();
    loadOrders();
  }, []);

  const loadUser = async () => {
    const userData = await AsyncStorage.getItem('user');
    if (userData) setUser(JSON.parse(userData));
  };

  const loadProducts = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_URL}/distributors`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        let allProducts = [];
        data.distributors.forEach(dist => {
          if (dist.products) {
            dist.products.forEach(p => {
              allProducts.push({ ...p, distributorName: dist.businessName, distributorId: dist._id });
            });
          }
        });
        setProducts(allProducts);
      }
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadOrders = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const userData = await AsyncStorage.getItem('user');
      const currentUser = JSON.parse(userData);
      const response = await fetch(`${API_URL}/orders?shopId=${currentUser?.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setOrders(data.orders || []);
        const total = data.orders.length;
        const pending = data.orders.filter(o => o.status === 'pending' || o.status === 'confirmed').length;
        const delivered = data.orders.filter(o => o.status === 'delivered').length;
        const spent = data.orders.reduce((sum, o) => sum + (o.total || 0), 0);
        setStats({ total, pending, delivered, spent });
      }
    } catch (error) {
      console.error('Error loading orders:', error);
    }
  };

  const handleSearch = () => {
    if (!searchTerm.trim()) {
      Alert.alert('Info', 'Please enter a product name to search');
      return;
    }
    const results = products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
    if (results.length === 0) {
      Alert.alert('No Results', `No products found for "${searchTerm}"`);
    } else {
      Alert.alert('Results Found', `${results.length} product(s) found for "${searchTerm}"`);
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    router.replace('/');
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadProducts();
    loadOrders();
  };

  const trackOrder = (orderId) => {
    router.push(`/tracking?orderId=${orderId}`);
  };

  const renderDashboard = () => (
    <>
      <Text style={styles.title}>🏪 Shop Dashboard</Text>
      <Text style={styles.subtitle}>Welcome to Restock! Start ordering products.</Text>

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
        <View style={[styles.statCard, styles.deliveredCard]}>
          <Text style={styles.statNumber}>{stats.delivered}</Text>
          <Text style={styles.statLabel}>Delivered</Text>
        </View>
        <View style={[styles.statCard, styles.spentCard]}>
          <Text style={styles.statNumber}>₦{stats.spent.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Total Spent</Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="🔍 Search products..."
          value={searchTerm}
          onChangeText={setSearchTerm}
          onSubmitEditing={handleSearch}
        />
        <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
          <Text style={styles.searchButtonText}>Search</Text>
        </TouchableOpacity>
      </View>

      {/* Orders Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📋 Your Orders</Text>
        {orders.length === 0 ? (
          <Text style={styles.emptyText}>No orders yet. Start shopping!</Text>
        ) : (
          orders.slice(0, 5).map((order, index) => (
            <View key={index} style={styles.orderItem}>
              <View>
                <Text style={styles.orderId}>#{order._id.slice(-6).toUpperCase()}</Text>
                <Text style={styles.orderStatus}>{order.status?.toUpperCase()}</Text>
                <Text style={styles.orderTotal}>₦{order.total?.toLocaleString()}</Text>
              </View>
              {(order.status === 'picked_up' || order.status === 'out_for_delivery') && (
                <TouchableOpacity style={styles.trackButton} onPress={() => trackOrder(order._id)}>
                  <Text style={styles.trackButtonText}>📍 Track</Text>
                </TouchableOpacity>
              )}
            </View>
          ))
        )}
      </View>

      {/* Products Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📦 Available Products</Text>
        {loading ? (
          <ActivityIndicator size="large" color="#01311F" style={styles.loader} />
        ) : products.length === 0 ? (
          <Text style={styles.emptyText}>No products available yet.</Text>
        ) : (
          products.slice(0, 5).map((product, index) => (
            <View key={index} style={styles.productItem}>
              <Text style={styles.productName}>{product.name}</Text>
              <Text style={styles.productPrice}>₦{product.price?.toLocaleString()}</Text>
              <Text style={styles.productDistributor}>from {product.distributorName}</Text>
            </View>
          ))
        )}
      </View>
    </>
  );

  const renderSettings = () => (
    <>
      <Text style={styles.title}>⚙️ Settings</Text>
      <Text style={styles.subtitle}>Manage your shop preferences.</Text>

      <TouchableOpacity style={styles.settingsItem} onPress={() => Alert.alert('Profile', 'Profile settings coming soon!')}>
        <Text style={styles.settingsIcon}>👤</Text>
        <View style={styles.settingsText}>
          <Text style={styles.settingsTitle}>Profile Settings</Text>
          <Text style={styles.settingsSubtitle}>Update your shop information</Text>
        </View>
        <Text style={styles.settingsArrow}>→</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.settingsItem} onPress={() => Alert.alert('Address', 'Address settings coming soon!')}>
        <Text style={styles.settingsIcon}>📍</Text>
        <View style={styles.settingsText}>
          <Text style={styles.settingsTitle}>Address Settings</Text>
          <Text style={styles.settingsSubtitle}>Update your delivery address</Text>
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
        <Text style={styles.welcome}>Hello, {user?.name || 'Shop Owner'}! 👋</Text>
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

      {/* Bottom Tab Bar */}
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
  delivered: '#1B5E20',
  spent: '#0D47A1',
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
  statCard: { flex: 1, minWidth: '45%', backgroundColor: COLORS.white, padding: 16, borderRadius: 12, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  pendingCard: { borderLeftWidth: 4, borderLeftColor: COLORS.pending },
  deliveredCard: { borderLeftWidth: 4, borderLeftColor: COLORS.delivered },
  spentCard: { borderLeftWidth: 4, borderLeftColor: COLORS.spent },
  statNumber: { fontSize: 22, fontWeight: '700', color: COLORS.primary },
  statLabel: { fontSize: 12, color: COLORS.gray, marginTop: 4 },
  searchContainer: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  searchInput: { flex: 1, backgroundColor: COLORS.white, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: COLORS.lightGray, fontSize: 16 },
  searchButton: { backgroundColor: COLORS.primary, paddingHorizontal: 20, borderRadius: 8, justifyContent: 'center' },
  searchButtonText: { color: COLORS.white, fontWeight: '600' },
  section: { backgroundColor: COLORS.white, padding: 16, borderRadius: 12, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12, color: COLORS.primary },
  loader: { marginVertical: 20 },
  orderItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  orderId: { fontSize: 14, fontWeight: '600', color: COLORS.primary },
  orderStatus: { fontSize: 12, fontWeight: '600', color: COLORS.gray, marginTop: 2 },
  orderTotal: { fontSize: 14, fontWeight: '700', color: COLORS.primary, marginTop: 2 },
  trackButton: { backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6 },
  trackButtonText: { color: COLORS.white, fontSize: 12, fontWeight: '600' },
  productItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  productName: { fontSize: 16, fontWeight: '600' },
  productPrice: { fontSize: 14, fontWeight: '700', color: COLORS.secondary, marginTop: 2 },
  productDistributor: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
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