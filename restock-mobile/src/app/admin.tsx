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
  const [stats, setStats] = useState({ orders: 0, shops: 0, distributors: 0, riders: 0, revenue: 0 });
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadUser();
    loadStats();
  }, []);

  const loadUser = async () => {
    const userData = await AsyncStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  };

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

      const orders = ordersData.orders || [];
      const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);

      setStats({
        orders: orders.length,
        shops: shopsData.shops?.length || 0,
        distributors: distributorsData.distributors?.length || 0,
        riders: ridersData.riders?.length || 0,
        revenue: totalRevenue,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
      Alert.alert('Error', 'Failed to load dashboard data');
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
    loadStats();
  };

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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text style={styles.title}>📊 Admin Dashboard</Text>
        <Text style={styles.subtitle}>Overview of your Restock platform.</Text>

        {/* Stats Cards */}
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
          <View style={[styles.statCard, styles.goldCard]}>
            <Text style={styles.statNumber}>₦{stats.revenue.toLocaleString()}</Text>
            <Text style={styles.statLabel}>💰 Revenue</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📋 Quick Actions</Text>
          <TouchableOpacity style={styles.actionButton} onPress={() => Alert.alert('Manage Users', 'User management coming soon!')}>
            <Text style={styles.actionText}>👤 Manage Users</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, styles.secondaryButton]} onPress={() => Alert.alert('View Reports', 'Reports coming soon!')}>
            <Text style={styles.actionText}>📊 View Reports</Text>
          </TouchableOpacity>
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
  green: '#1B5E20',
  blue: '#0D47A1',
  orange: '#E65100',
  gold: '#F57F17',
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
  greenCard: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.green,
  },
  blueCard: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.blue,
  },
  orangeCard: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.orange,
  },
  goldCard: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.gold,
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
  actionButton: {
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: COLORS.secondary,
  },
  actionText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: 16,
  },
  loader: {
    marginVertical: 20,
  },
});