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
        // Calculate stats
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

  const handleProducts = () => {
  // Show products from the distributor
  const token = AsyncStorage.getItem('token');
  // For now, show a list of products from orders
  const productNames = [...new Set(orders.map(o => 
    o.items?.map(i => i.productName).join(', ')
  ).filter(Boolean))].flat();
  
  Alert.alert(
    '📦 Your Products',
    productNames.length > 0 
      ? productNames.slice(0, 10).join('\n') 
      : 'No products added yet. Go to the web dashboard to add products.'
  );
};

const handleAnalytics = () => {
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

const handlePayments = () => {
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
          <TouchableOpacity style={styles.card} onPress={handleProducts}>
            <Text style={styles.cardIcon}>📦</Text>
            <Text style={styles.cardTitle}>Products</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.card} onPress={handleAnalytics}>
            <Text style={styles.cardIcon}>📊</Text>
            <Text style={styles.cardTitle}>Analytics</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.card} onPress={handlePayments}>
            <Text style={styles.cardIcon}>💰</Text>
            <Text style={styles.cardTitle}>Payments</Text>
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
      </ScrollView>
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
    paddingBottom: 40,
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
});