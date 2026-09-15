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

export default function AdminScreen() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Dashboard stats
  const [stats, setStats] = useState({
    orders: 0,
    shops: 0,
    distributors: 0,
    riders: 0,
    revenue: 0,
  });

  // Orders list
  const [orders, setOrders] = useState([]);
  const [orderFilter, setOrderFilter] = useState('all');

  // Requests list
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    loadUser();
    loadStats();
    loadOrders();
    loadRequests();
  }, []);

  const loadUser = async () => {
    const userData = await AsyncStorage.getItem('user');
    if (userData) setUser(JSON.parse(userData));
  };

  // ============================================================
  // LOAD STATS
  // ============================================================
  const loadStats = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');

      const [ordersRes, shopsRes, distributorsRes, ridersRes] = await Promise.all([
        fetch(`${API_URL}/orders`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/shops`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/distributors`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/riders`, { headers: { 'Authorization': `Bearer ${token}` } }),
      ]);

      const ordersData = await ordersRes.json();
      const shopsData = await shopsRes.json();
      const distributorsData = await distributorsRes.json();
      const ridersData = await ridersRes.json();

      const allOrders = ordersData.orders || [];
      const totalRevenue = allOrders.reduce((sum, o) => sum + (o.total || 0), 0);

      setStats({
        orders: allOrders.length,
        shops: shopsData.shops?.length || 0,
        distributors: distributorsData.distributors?.length || 0,
        riders: ridersData.riders?.length || 0,
        revenue: totalRevenue,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // ============================================================
  // LOAD ORDERS
  // ============================================================
  const loadOrders = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_URL}/orders`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setOrders(data.orders || []);
      }
    } catch (error) {
      console.error('Error loading orders:', error);
    }
  };

  // ============================================================
  // LOAD PRODUCT REQUESTS
  // ============================================================
  const loadRequests = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_URL}/product-requests`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setRequests(data.requests || []);
      }
    } catch (error) {
      console.error('Error loading requests:', error);
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    router.replace('/');
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadStats();
    loadOrders();
    loadRequests();
  };

  // ============================================================
  // ORDER DETAILS
  // ============================================================
  const showOrderDetails = (order) => {
    const items = (order.items || []).map(i => 
      `${i.productName} x${i.quantity}`
    ).join('\n');
    
    Alert.alert(
      `📦 Order #${order._id.slice(-6).toUpperCase()}`,
      `🏪 Shop: ${order.shopId?.businessName || 'Unknown'}\n` +
      `📦 Distributor: ${order.distributorId?.businessName || 'Unknown'}\n` +
      `🏍️ Rider: ${order.riderId?.fullName || 'Not assigned'}\n\n` +
      `📋 Items:\n${items}\n\n` +
      `💰 Total: ₦${order.total?.toLocaleString()}\n` +
      `📊 Status: ${order.status?.toUpperCase()}\n` +
      `📅 Date: ${new Date(order.createdAt).toLocaleDateString()}`
    );
  };

  // ============================================================
  // UPDATE REQUEST STATUS
  // ============================================================
  const updateRequestStatus = async (requestId, status) => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_URL}/product-requests/${requestId}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      });

      const data = await response.json();
      if (data.success) {
        Alert.alert('✅ Success', `Request marked as ${status}`);
        loadRequests();
      } else {
        Alert.alert('❌ Error', data.error || 'Failed to update');
      }
    } catch (error) {
      console.error('Update error:', error);
      Alert.alert('❌ Error', 'Could not update request');
    }
  };

  // ============================================================
  // RENDER DASHBOARD
  // ============================================================
  const renderDashboard = () => (
    <>
      <Text style={styles.title}>📊 Admin Dashboard</Text>
      <Text style={styles.subtitle}>Overview of your Restock platform.</Text>

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.orders}</Text>
          <Text style={styles.statLabel}>📦 Orders</Text>
        </View>
        <View style={[styles.statCard, styles.greenCard]}>
          <Text style={styles.statNumber}>{stats.shops}</Text>
          <Text style={styles.statLabel}>🏪 Shops</Text>
        </View>
        <View style={[styles.statCard, styles.blueCard]}>
          <Text style={styles.statNumber}>{stats.distributors}</Text>
          <Text style={styles.statLabel}>📦 Distributors</Text>
        </View>
        <View style={[styles.statCard, styles.orangeCard]}>
          <Text style={styles.statNumber}>{stats.riders}</Text>
          <Text style={styles.statLabel}>🏍️ Riders</Text>
        </View>
      </View>

      <View style={styles.revenueCard}>
        <Text style={styles.revenueLabel}>💰 Total Revenue</Text>
        <Text style={styles.revenueValue}>₦{stats.revenue.toLocaleString()}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📋 Recent Orders</Text>
        {orders.slice(0, 5).map((order, index) => (
          <TouchableOpacity 
            key={index} 
            style={styles.orderItem}
            onPress={() => showOrderDetails(order)}
          >
            <View>
              <Text style={styles.orderId}>#{order._id.slice(-6).toUpperCase()}</Text>
              <Text style={styles.orderShop}>🏪 {order.shopId?.businessName || 'Unknown'}</Text>
            </View>
            <View style={styles.orderRight}>
              <Text style={styles.orderTotal}>₦{order.total?.toLocaleString()}</Text>
              <Text style={styles.orderStatus}>{order.status?.toUpperCase()}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </>
  );

  // ============================================================
  // RENDER ORDERS
  // ============================================================
  const renderOrders = () => {
    const filteredOrders = orderFilter === 'all' 
      ? orders 
      : orders.filter(o => o.status === orderFilter);

    return (
      <>
        <Text style={styles.title}>📦 All Orders</Text>
        <Text style={styles.subtitle}>{orders.length} total orders</Text>

        {/* Filter Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {['all', 'pending', 'confirmed', 'picked_up', 'delivered'].map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[
                styles.filterChip,
                orderFilter === filter && styles.filterChipActive
              ]}
              onPress={() => setOrderFilter(filter)}
            >
              <Text style={[
                styles.filterChipText,
                orderFilter === filter && styles.filterChipTextActive
              ]}>
                {filter === 'all' ? 'All' : filter.replace('_', ' ').toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading ? (
          <ActivityIndicator size="large" color="#01311F" style={styles.loader} />
        ) : filteredOrders.length === 0 ? (
          <Text style={styles.emptyText}>No orders found</Text>
        ) : (
          filteredOrders.map((order, index) => (
            <TouchableOpacity 
              key={index} 
              style={styles.orderCardFull}
              onPress={() => showOrderDetails(order)}
            >
              <View style={styles.orderHeader}>
                <Text style={styles.orderIdLarge}>#{order._id.slice(-6).toUpperCase()}</Text>
                <Text style={[
                  styles.orderStatusBadge,
                  order.status === 'delivered' ? styles.statusDelivered : styles.statusPending
                ]}>
                  {order.status?.toUpperCase()}
                </Text>
              </View>
              <Text style={styles.orderShop}>🏪 {order.shopId?.businessName || 'Unknown'}</Text>
              <Text style={styles.orderDist}>📦 {order.distributorId?.businessName || 'Unknown'}</Text>
              <View style={styles.orderFooter}>
                <Text style={styles.orderDate}>
                  📅 {new Date(order.createdAt).toLocaleDateString()}
                </Text>
                <Text style={styles.orderTotalLarge}>
                  ₦{order.total?.toLocaleString()}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </>
    );
  };

  // ============================================================
  // RENDER REQUESTS
  // ============================================================
  const renderRequests = () => (
    <>
      <Text style={styles.title}>📝 Product Requests</Text>
      <Text style={styles.subtitle}>{requests.length} total requests</Text>

      {requests.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateIcon}>📝</Text>
          <Text style={styles.emptyStateText}>No product requests yet</Text>
        </View>
      ) : (
        requests.map((request, index) => (
          <View key={index} style={styles.requestCard}>
            <View style={styles.requestHeader}>
              <Text style={styles.requestName}>{request.productName}</Text>
              <Text style={[
                styles.requestStatus,
                request.status === 'found' ? styles.statusDelivered : styles.statusPending
              ]}>
                {request.status?.toUpperCase()}
              </Text>
            </View>
            <Text style={styles.requestShop}>🏪 {request.shopId?.businessName || 'Unknown'}</Text>
            <Text style={styles.requestPhone}>📞 {request.shopId?.phone || 'No phone'}</Text>
            <Text style={styles.requestQty}>📦 {request.quantity} {request.unit}(s)</Text>
            {request.notes ? (
              <Text style={styles.requestNotes}>📝 {request.notes}</Text>
            ) : null}
            
            {request.status === 'pending' && (
              <View style={styles.requestActions}>
                <TouchableOpacity 
                  style={[styles.actionBtn, styles.sourcingBtn]}
                  onPress={() => updateRequestStatus(request._id, 'sourcing')}
                >
                  <Text style={styles.actionBtnText}>🔍 Sourcing</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.actionBtn, styles.foundBtn]}
                  onPress={() => updateRequestStatus(request._id, 'found')}
                >
                  <Text style={styles.actionBtnText}>✅ Found</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))
      )}
    </>
  );

  // ============================================================
  // RENDER SETTINGS
  // ============================================================
  const renderSettings = () => (
    <>
      <Text style={styles.title}>⚙️ Settings</Text>
      <Text style={styles.subtitle}>Manage platform preferences.</Text>

      <TouchableOpacity style={styles.settingsItem} onPress={() => Alert.alert('Platform', 'Coming soon!')}>
        <Text style={styles.settingsIcon}>⚙️</Text>
        <View style={styles.settingsText}>
          <Text style={styles.settingsTitle}>Platform Settings</Text>
          <Text style={styles.settingsSubtitle}>Commission, delivery fee, etc.</Text>
        </View>
        <Text style={styles.settingsArrow}>→</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.settingsItem} onPress={() => Alert.alert('Users', `Shops: ${stats.shops}\nDistributors: ${stats.distributors}\nRiders: ${stats.riders}`)}>
        <Text style={styles.settingsIcon}>👥</Text>
        <View style={styles.settingsText}>
          <Text style={styles.settingsTitle}>User Management</Text>
          <Text style={styles.settingsSubtitle}>View all users</Text>
        </View>
        <Text style={styles.settingsArrow}>→</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.settingsItem} onPress={() => Alert.alert('Bank', 'Coming soon!')}>
        <Text style={styles.settingsIcon}>💰</Text>
        <View style={styles.settingsText}>
          <Text style={styles.settingsTitle}>Bank Details</Text>
          <Text style={styles.settingsSubtitle}>Manage payment account</Text>
        </View>
        <Text style={styles.settingsArrow}>→</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.settingsItem, styles.dangerItem]} onPress={() => Alert.alert('Warning', 'Deactivation coming soon!')}>
        <Text style={styles.settingsIcon}>⚠️</Text>
        <View style={styles.settingsText}>
          <Text style={[styles.settingsTitle, styles.dangerText]}>Deactivate Platform</Text>
          <Text style={styles.settingsSubtitle}>Permanently disable</Text>
        </View>
        <Text style={styles.settingsArrow}>→</Text>
      </TouchableOpacity>
    </>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.welcome}>Hello, {user?.name || 'Admin'}! 👋</Text>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>🚪</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'orders' && renderOrders()}
        {activeTab === 'requests' && renderRequests()}
        {activeTab === 'settings' && renderSettings()}
      </ScrollView>

      {/* Bottom Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'dashboard' && styles.tabItemActive]}
          onPress={() => setActiveTab('dashboard')}
        >
          <Text style={styles.tabIcon}>📊</Text>
          <Text style={[styles.tabLabel, activeTab === 'dashboard' && styles.tabLabelActive]}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'orders' && styles.tabItemActive]}
          onPress={() => setActiveTab('orders')}
        >
          <Text style={styles.tabIcon}>📦</Text>
          <Text style={[styles.tabLabel, activeTab === 'orders' && styles.tabLabelActive]}>Orders</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'requests' && styles.tabItemActive]}
          onPress={() => setActiveTab('requests')}
        >
          <Text style={styles.tabIcon}>📝</Text>
          <Text style={[styles.tabLabel, activeTab === 'requests' && styles.tabLabelActive]}>Requests</Text>
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
  green: '#1B5E20',
  blue: '#0D47A1',
  orange: '#E65100',
  gold: '#F57F17',
  danger: '#E17055',
  pending: '#E65100',
  delivered: '#1B5E20',
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
  loader: { marginVertical: 40 },
  // Stats
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  statCard: { flex: 1, minWidth: '45%', backgroundColor: COLORS.white, padding: 16, borderRadius: 12, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  greenCard: { borderLeftWidth: 4, borderLeftColor: COLORS.green },
  blueCard: { borderLeftWidth: 4, borderLeftColor: COLORS.blue },
  orangeCard: { borderLeftWidth: 4, borderLeftColor: COLORS.orange },
  statNumber: { fontSize: 24, fontWeight: '700', color: COLORS.primary },
  statLabel: { fontSize: 12, color: COLORS.gray, marginTop: 4 },
  revenueCard: { backgroundColor: COLORS.primary, padding: 24, borderRadius: 12, alignItems: 'center', marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 },
  revenueLabel: { fontSize: 14, color: COLORS.white, opacity: 0.8 },
  revenueValue: { fontSize: 32, fontWeight: '800', color: COLORS.white, marginTop: 8 },
  // Sections
  section: { backgroundColor: COLORS.white, padding: 16, borderRadius: 12, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12, color: COLORS.primary },
  // Orders
  filterScroll: { marginBottom: 16, paddingBottom: 8 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.white, marginRight: 8, borderWidth: 1, borderColor: COLORS.lightGray },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterChipText: { fontSize: 12, color: COLORS.gray, fontWeight: '600' },
  filterChipTextActive: { color: COLORS.white },
  orderItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  orderCardFull: { backgroundColor: COLORS.white, padding: 16, borderRadius: 12, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  orderId: { fontSize: 14, fontWeight: '600', color: COLORS.primary },
  orderIdLarge: { fontSize: 16, fontWeight: '700', color: COLORS.primary },
  orderShop: { fontSize: 14, color: COLORS.gray, marginTop: 2 },
  orderDist: { fontSize: 13, color: COLORS.gray, marginTop: 2 },
  orderRight: { alignItems: 'flex-end' },
  orderFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.lightGray },
  orderDate: { fontSize: 12, color: COLORS.gray },
  orderTotal: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  orderTotalLarge: { fontSize: 16, fontWeight: '700', color: COLORS.primary },
  orderStatus: { fontSize: 11, fontWeight: '600', color: COLORS.gray, marginTop: 2 },
  orderStatusBadge: { fontSize: 11, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusPending: { backgroundColor: '#FFF3E0', color: '#E65100' },
  statusDelivered: { backgroundColor: '#E8F5E9', color: '#1B5E20' },
  // Requests
  requestCard: { backgroundColor: COLORS.white, padding: 16, borderRadius: 12, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  requestHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  requestName: { fontSize: 16, fontWeight: '700', color: COLORS.primary, flex: 1 },
  requestStatus: { fontSize: 10, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  requestShop: { fontSize: 13, color: COLORS.gray, marginTop: 2 },
  requestPhone: { fontSize: 13, color: COLORS.gray, marginTop: 2 },
  requestQty: { fontSize: 13, color: COLORS.gray, marginTop: 2 },
  requestNotes: { fontSize: 13, color: COLORS.gray, marginTop: 4, fontStyle: 'italic' },
  requestActions: { flexDirection: 'row', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.lightGray },
  actionBtn: { flex: 1, padding: 10, borderRadius: 8, alignItems: 'center' },
  sourcingBtn: { backgroundColor: '#E3F2FD' },
  foundBtn: { backgroundColor: COLORS.secondary },
  actionBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  // Settings
  settingsItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, padding: 16, borderRadius: 12, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  dangerItem: { borderWidth: 1, borderColor: COLORS.danger },
  settingsIcon: { fontSize: 24, marginRight: 16 },
  settingsText: { flex: 1 },
  settingsTitle: { fontSize: 16, fontWeight: '600', color: COLORS.primary },
  settingsSubtitle: { fontSize: 13, color: COLORS.gray, marginTop: 2 },
  settingsArrow: { fontSize: 20, color: COLORS.gray },
  dangerText: { color: COLORS.danger },
  // Empty
  emptyText: { color: COLORS.gray, textAlign: 'center', padding: 40 },
  emptyState: { alignItems: 'center', padding: 60 },
  emptyStateIcon: { fontSize: 48, marginBottom: 12 },
  emptyStateText: { color: COLORS.gray, fontSize: 16 },
  // Tab bar
  tabBar: { flexDirection: 'row', backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.lightGray, paddingVertical: 8, paddingBottom: 20 },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  tabItemActive: { borderTopWidth: 3, borderTopColor: COLORS.primary, marginTop: -11 },
  tabIcon: { fontSize: 22 },
  tabLabel: { fontSize: 11, color: COLORS.gray, marginTop: 4 },
  tabLabelActive: { color: COLORS.primary, fontWeight: '600' },
});