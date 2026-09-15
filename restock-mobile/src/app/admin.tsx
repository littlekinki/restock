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
  const [stats, setStats] = useState({
    orders: 0,
    shops: 0,
    distributors: 0,
    riders: 0,
    revenue: 0,
  });
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');

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

  const renderDashboard = () => (
    <>
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
      </View>

      {/* Revenue Card */}
      <View style={styles.revenueCard}>
        <Text style={styles.revenueLabel}>💰 Total Revenue</Text>
        <Text style={styles.revenueValue}>₦{stats.revenue.toLocaleString()}</Text>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📋 Quick Actions</Text>

        <TouchableOpacity style={styles.actionButton} onPress={() => Alert.alert('Manage Users', 'User management coming soon!')}>
          <Text style={styles.actionIcon}>👤</Text>
          <View style={styles.actionTextContainer}>
            <Text style={styles.actionTitle}>Manage Users</Text>
            <Text style={styles.actionSubtitle}>View and manage all users</Text>
          </View>
          <Text style={styles.actionArrow}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionButton, styles.secondaryButton]} onPress={() => Alert.alert('View Reports', 'Reports coming soon!')}>
          <Text style={styles.actionIcon}>📊</Text>
          <View style={styles.actionTextContainer}>
            <Text style={styles.actionTitle}>View Reports</Text>
            <Text style={styles.actionSubtitle}>Analytics and business insights</Text>
          </View>
          <Text style={styles.actionArrow}>→</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  const renderSettings = () => (
    <>
      <Text style={styles.title}>⚙️ Settings</Text>
      <Text style={styles.subtitle}>Manage platform preferences.</Text>

      <TouchableOpacity style={styles.settingsItem} onPress={() => Alert.alert('Platform', 'Platform settings coming soon!')}>
        <Text style={styles.settingsIcon}>⚙️</Text>
        <View style={styles.settingsText}>
          <Text style={styles.settingsTitle}>Platform Settings</Text>
          <Text style={styles.settingsSubtitle}>Commission, delivery fee, etc.</Text>
        </View>
        <Text style={styles.settingsArrow}>→</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.settingsItem} onPress={() => Alert.alert('Users', `Shops: ${stats.shops}, Distributors: ${stats.distributors}, Riders: ${stats.riders}`)}>
        <Text style={styles.settingsIcon}>👥</Text>
        <View style={styles.settingsText}>
          <Text style={styles.settingsTitle}>User Management</Text>
          <Text style={styles.settingsSubtitle}>View all platform users</Text>
        </View>
        <Text style={styles.settingsArrow}>→</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.settingsItem} onPress={() => Alert.alert('Bank', 'Bank details settings coming soon!')}>
        <Text style={styles.settingsIcon}>💰</Text>
        <View style={styles.settingsText}>
          <Text style={styles.settingsTitle}>Bank Details</Text>
          <Text style={styles.settingsSubtitle}>Manage platform payment account</Text>
        </View>
        <Text style={styles.settingsArrow}>→</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.settingsItem} onPress={() => Alert.alert('Notifications', 'Notification settings coming soon!')}>
        <Text style={styles.settingsIcon}>🔔</Text>
        <View style={styles.settingsText}>
          <Text style={styles.settingsTitle}>Notifications</Text>
          <Text style={styles.settingsSubtitle}>SMS and WhatsApp settings</Text>
        </View>
        <Text style={styles.settingsArrow}>→</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.settingsItem} onPress={() => Alert.alert('Maintenance', 'Maintenance mode coming soon!')}>
        <Text style={styles.settingsIcon}>🔧</Text>
        <View style={styles.settingsText}>
          <Text style={styles.settingsTitle}>Maintenance Mode</Text>
          <Text style={styles.settingsSubtitle}>Temporarily disable platform</Text>
        </View>
        <Text style={styles.settingsArrow}>→</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.settingsItem, styles.dangerItem]} onPress={() => Alert.alert('Warning', 'Platform deactivation coming soon!')}>
        <Text style={styles.settingsIcon}>⚠️</Text>
        <View style={styles.settingsText}>
          <Text style={[styles.settingsTitle, styles.dangerText]}>Deactivate Platform</Text>
          <Text style={styles.settingsSubtitle}>Permanently disable the platform</Text>
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
        {loading ? (
          <ActivityIndicator size="large" color="#01311F" style={styles.loader} />
        ) : activeTab === 'dashboard' ? renderDashboard() : renderSettings()}
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
  green: '#1B5E20',
  blue: '#0D47A1',
  orange: '#E65100',
  gold: '#F57F17',
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
  loader: {
    marginVertical: 40,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
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
  revenueCard: {
    backgroundColor: COLORS.primary,
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  revenueLabel: {
    fontSize: 14,
    color: COLORS.white,
    opacity: 0.8,
  },
  revenueValue: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.white,
    marginTop: 8,
  },
  section: {
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  secondaryButton: {
    backgroundColor: COLORS.secondary,
  },
  actionIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  actionTextContainer: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
  },
  actionSubtitle: {
    fontSize: 13,
    color: COLORS.white,
    opacity: 0.8,
    marginTop: 2,
  },
  actionArrow: {
    fontSize: 20,
    color: COLORS.white,
  },
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