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

  useEffect(() => {
    loadUser();
    loadProducts();
    loadOrders();
  }, []);

  const loadUser = async () => {
    const userData = await AsyncStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
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
              allProducts.push({
                ...p,
                distributorName: dist.businessName,
                distributorId: dist._id
              });
            });
          }
        });
        setProducts(allProducts);
      }
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadOrders = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const userData = await AsyncStorage.getItem('user');
      const user = JSON.parse(userData);
      
      const response = await fetch(`${API_URL}/orders?shopId=${user?.id}`, {
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

  const handleSearch = () => {
    if (!searchTerm.trim()) {
      Alert.alert('Info', 'Please enter a product name to search');
      return;
    }
    
    const results = products.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
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

  const handleCart = () => {
    Alert.alert('Coming Soon', 'Cart functionality will be available soon!');
  };

  const handleFavorites = () => {
    Alert.alert('Coming Soon', 'Favorites will be available soon!');
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadProducts();
    loadOrders();
    setRefreshing(false);
  };

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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text style={styles.title}>🏪 Shop Dashboard</Text>
        <Text style={styles.subtitle}>Welcome to Restock! Start ordering products for your shop.</Text>

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

        {/* Quick Actions Grid */}
        <View style={styles.grid}>
          <TouchableOpacity style={styles.card} onPress={() => Alert.alert('Search', 'Use the search bar above!')}>
            <Text style={styles.cardIcon}>🔍</Text>
            <Text style={styles.cardTitle}>Search Products</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.card} onPress={handleCart}>
            <Text style={styles.cardIcon}>🛒</Text>
            <Text style={styles.cardTitle}>My Cart</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.card} onPress={() => Alert.alert('Orders', `You have ${orders.length} total orders`)}>
            <Text style={styles.cardIcon}>📦</Text>
            <Text style={styles.cardTitle}>Orders</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.card} onPress={handleFavorites}>
            <Text style={styles.cardIcon}>⭐</Text>
            <Text style={styles.cardTitle}>Favorites</Text>
          </TouchableOpacity>
        </View>

        {/* ============================================================
            📋 ORDERS SECTION WITH TRACK BUTTON
            ============================================================ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📋 Your Orders</Text>
          {orders.length === 0 ? (
            <Text style={styles.emptyText}>No orders yet. Start shopping!</Text>
          ) : (
            orders.slice(0, 5).map((order, index) => {
              const deliveryAddress = order.deliveryAddress;
              const pickupAddress = order.pickupAddress;
              
              return (
                <View key={index} style={styles.orderItem}>
                  <View>
                    <Text style={styles.orderId}>#{order._id.slice(-6).toUpperCase()}</Text>
                    <Text style={styles.orderStatus}>{order.status?.toUpperCase()}</Text>
                    <Text style={styles.orderAddress}>
                      📍 {deliveryAddress?.city || 'Unknown'}
                      {pickupAddress?.distributorName ? ` | 📦 ${pickupAddress.distributorName}` : ''}
                    </Text>
                    <Text style={styles.orderTotal}>₦{order.total?.toLocaleString()}</Text>
                  </View>
                  
                  {/* ✅ TRACK BUTTON - Shows only when order is in delivery */}
                  {(order.status === 'picked_up' || order.status === 'out_for_delivery') && (
                    <TouchableOpacity 
                      style={styles.trackButton}
                      onPress={() => router.push(`/tracking?orderId=${order._id}`)}
                    >
                      <Text style={styles.trackButtonText}>📍 Track</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
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
  searchContainer: {
    flexDirection: 'row',
    marginBottom: 24,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    backgroundColor: COLORS.white,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    fontSize: 16,
  },
  searchButton: {
    backgroundColor: COLORS.primary,
    padding: 12,
    borderRadius: 8,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  searchButtonText: {
    color: COLORS.white,
    fontWeight: '600',
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
  productItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
  },
  productPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.secondary,
    marginTop: 2,
  },
  productDistributor: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 2,
  },
  // ✅ ORDER STYLES
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
    color: COLORS.primary,
  },
  orderStatus: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
    color: COLORS.gray,
  },
  orderAddress: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 2,
  },
  orderTotal: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
    marginTop: 2,
  },
  trackButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  trackButtonText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '600',
  },
  emptyText: {
    color: COLORS.gray,
    textAlign: 'center',
    padding: 20,
  },
});