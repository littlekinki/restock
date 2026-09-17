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
  TextInput,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

const API_URL = 'https://restock-backend-zkrx.onrender.com/api';

export default function DistributorScreen() {
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ total: 0, pending: 0, confirmed: 0, delivered: 0 });
  const [activeTab, setActiveTab] = useState('dashboard');

  // Product form state
  const [showProductForm, setShowProductForm] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: '',
    category: 'Noodles',
    price: '',
    unit: 'carton',
    size: '',
    stock: '',
  });

  // Chat state
  const [showChat, setShowChat] = useState(false);
  const [chatOrderId, setChatOrderId] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [chatReceiver, setChatReceiver] = useState(null);

  useEffect(() => {
    loadUser();
    loadOrders();
    loadProducts();
  }, []);

  const loadUser = async () => {
    const userData = await AsyncStorage.getItem('user');
    if (userData) setUser(JSON.parse(userData));
  };

  // ============================================================
  // LOAD ORDERS
  // ============================================================
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
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // ============================================================
  // LOAD PRODUCTS
  // ============================================================
  const loadProducts = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const userData = await AsyncStorage.getItem('user');
      const currentUser = JSON.parse(userData);

      const response = await fetch(`${API_URL}/distributors`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();

      if (data.success) {
        const distributor = data.distributors.find(d => d._id === currentUser.id);
        if (distributor && distributor.products) {
          setProducts(distributor.products);
        }
      }
    } catch (error) {
      console.error('Error loading products:', error);
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
    loadProducts();
  };

  // ============================================================
  // CONFIRM ORDER
  // ============================================================
  const handleOrderPress = (order) => {
    if (order.status === 'pending') {
      Alert.alert(
        '📦 Confirm Order',
        `Order #${order._id.slice(-6).toUpperCase()}\n` +
        `Total: ₦${order.total?.toLocaleString()}\n\n` +
        `Do you want to confirm this order?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: '✅ Confirm', onPress: () => confirmOrder(order._id) }
        ]
      );
    } else if (order.status === 'confirmed') {
      Alert.alert(
        '📍 Assign Rider',
        `Order #${order._id.slice(-6).toUpperCase()}\n\n` +
        `This order is confirmed. Would you like to assign a rider?`,
        [
          { text: 'Later', style: 'cancel' },
          { text: '📍 Assign Rider', onPress: () => assignRider(order._id) }
        ]
      );
    } else {
      Alert.alert(
        '📦 Order Details',
        `Order #${order._id.slice(-6).toUpperCase()}\n` +
        `Status: ${order.status?.toUpperCase()}\n` +
        `Total: ₦${order.total?.toLocaleString()}`
      );
    }
  };

  const confirmOrder = async (orderId) => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_URL}/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: 'confirmed',
          note: 'Order confirmed by distributor'
        })
      });
      const data = await response.json();
      if (data.success) {
        Alert.alert('✅ Success', 'Order confirmed!');
        loadOrders();
      } else {
        Alert.alert('❌ Error', data.error || 'Failed to confirm order');
      }
    } catch (error) {
      Alert.alert('❌ Error', 'Could not confirm order');
    }
  };

  // ============================================================
  // ASSIGN RIDER
  // ============================================================
  const assignRider = async (orderId) => {
    try {
      const token = await AsyncStorage.getItem('token');
      const riderResponse = await fetch(`${API_URL}/riders`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const riderData = await riderResponse.json();

      if (!riderData.success || riderData.riders.length === 0) {
        Alert.alert('⚠️ No Riders', 'There are no riders available. Please add a rider first.');
        return;
      }

      const riders = riderData.riders.slice(0, 3);
      const buttons = riders.map((rider) => ({
        text: `${rider.fullName} (${rider.vehicleType || 'motorcycle'})`,
        onPress: () => doAssignRider(orderId, rider._id)
      }));

      Alert.alert(
        '👤 Select Rider',
        `Choose a rider for this order:`,
        [
          { text: 'Cancel', style: 'cancel' },
          ...buttons
        ]
      );
    } catch (error) {
      Alert.alert('❌ Error', 'Could not fetch riders');
    }
  };

  const doAssignRider = async (orderId, riderId) => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_URL}/orders/${orderId}/assign-rider`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ riderId })
      });
      const data = await response.json();
      if (data.success) {
        Alert.alert('✅ Success', 'Rider assigned! PIN sent to customer.');
        loadOrders();
      } else {
        Alert.alert('❌ Error', data.error || 'Failed to assign rider');
      }
    } catch (error) {
      Alert.alert('❌ Error', 'Could not assign rider');
    }
  };

    // ============================================================
  // CANCEL ORDER
  // ============================================================
  const cancelOrder = (order) => {
    Alert.alert(
      '❌ Cancel Order',
      `Order #${order._id.slice(-6).toUpperCase()}\n` +
      `Total: ₦${order.total?.toLocaleString()}\n\n` +
      `Are you sure you want to cancel this order?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: () => doCancelOrder(order._id)
        }
      ]
    );
  };
  
  const doCancelOrder = async (orderId) => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_URL}/orders/${orderId}/cancel`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reason: 'Cancelled by distributor'
        })
      });
      const data = await response.json();
      if (data.success) {
        Alert.alert('✅ Cancelled', 'Order has been cancelled.');
        loadOrders();
      } else {
        Alert.alert('❌ Error', data.error || 'Failed to cancel order');
      }
    } catch (error) {
      Alert.alert('❌ Error', 'Could not cancel order');
    }
  };

  // ============================================================
  // SAVE NEW PRODUCT
  // ============================================================
  const saveNewProduct = async () => {
    const { name, category, price, unit, size, stock } = newProduct;

    if (!name || !price || !stock) {
      Alert.alert('⚠️ Missing Fields', 'Please fill in product name, price, and stock.');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('token');
      const userData = await AsyncStorage.getItem('user');
      const currentUser = JSON.parse(userData);

      const distResponse = await fetch(`${API_URL}/distributors`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const distData = await distResponse.json();
      const distributor = distData.distributors.find(d => d._id === currentUser.id);

      if (!distributor) {
        Alert.alert('❌ Error', 'Distributor not found');
        return;
      }

      const productToAdd = {
        name: name,
        category: category,
        price: parseFloat(price),
        unit: unit,
        size: size,
        stock: parseInt(stock),
      };

      const updatedProducts = [...(distributor.products || []), productToAdd];

      const response = await fetch(`${API_URL}/distributors/${distributor._id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ products: updatedProducts })
      });

      const data = await response.json();
      if (data.success) {
        Alert.alert('✅ Success', 'Product added successfully!');
        setShowProductForm(false);
        setNewProduct({ name: '', category: 'Noodles', price: '', unit: 'carton', size: '', stock: '' });
        loadProducts();
      } else {
        Alert.alert('❌ Error', data.error || 'Failed to add product');
      }
    } catch (error) {
      Alert.alert('❌ Error', 'Could not add product');
    }
  };

  const deleteProduct = async (index) => {
    Alert.alert(
      '🗑️ Delete Product',
      `Are you sure you want to delete "${products[index].name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('token');
              const userData = await AsyncStorage.getItem('user');
              const currentUser = JSON.parse(userData);

              const distResponse = await fetch(`${API_URL}/distributors`, {
                headers: { 'Authorization': `Bearer ${token}` }
              });
              const distData = await distResponse.json();
              const distributor = distData.distributors.find(d => d._id === currentUser.id);

              const updatedProducts = distributor.products.filter((_, i) => i !== index);

              const response = await fetch(`${API_URL}/distributors/${distributor._id}`, {
                method: 'PUT',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ products: updatedProducts })
              });

              const data = await response.json();
              if (data.success) {
                Alert.alert('✅ Deleted', 'Product removed.');
                loadProducts();
              }
            } catch (error) {
              Alert.alert('❌ Error', 'Could not delete product');
            }
          }
        }
      ]
    );
  };

  // ============================================================
  // OPEN CHAT (Distributor chats with Shop)
  // ============================================================
  const openChat = async (order) => {
    setChatOrderId(order._id);
    setShowChat(true);

    setChatReceiver({
      id: order.shopId?._id || order.shopId,
      role: 'shop',
      name: order.shopId?.businessName || 'Shop'
    });

    await loadMessages(order._id);
  };

  // ============================================================
  // LOAD MESSAGES
  // ============================================================
  const loadMessages = async (orderId) => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_URL}/chat/order/${orderId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setChatMessages(data.messages || []);
      }
    } catch (error) {
      console.error('Load messages error:', error);
    }
  };

  // ============================================================
  // SEND MESSAGE
  // ============================================================
  const sendMessage = async () => {
    if (!chatInput.trim() || !chatReceiver) return;
    setSendingMessage(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_URL}/chat/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          orderId: chatOrderId,
          receiverId: chatReceiver.id,
          receiverRole: chatReceiver.role,
          message: chatInput.trim()
        })
      });
      const data = await response.json();
      if (data.success) {
        setChatInput('');
        await loadMessages(chatOrderId);
      } else {
        Alert.alert('❌ Error', data.error || 'Failed to send');
      }
    } catch (error) {
      Alert.alert('❌ Error', 'Could not send message');
    } finally {
      setSendingMessage(false);
    }
  };

  // ============================================================
  // SHOW PRODUCTS
  // ============================================================
  const showProducts = () => {
    if (products.length === 0) {
      Alert.alert(
        '📦 No Products Yet',
        'You haven\'t added any products. Would you like to add your first product?',
        [
          { text: 'Later', style: 'cancel' },
          { text: '➕ Add Product', onPress: () => setShowProductForm(true) }
        ]
      );
      return;
    }

    const productList = products.slice(0, 5).map((p, i) =>
      `${i + 1}. ${p.name} - ₦${p.price?.toLocaleString()}\n   📦 ${p.stock} in stock`
    ).join('\n\n');

    Alert.alert(
      '📦 Your Products',
      `${productList}\n\n${products.length > 5 ? `...and ${products.length - 5} more` : ''}`,
      [
        { text: 'Close', style: 'cancel' },
        { text: '➕ Add Product', onPress: () => setShowProductForm(true) }
      ]
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

  // ============================================================
  // RENDER PRODUCT FORM
  // ============================================================
  const renderProductForm = () => (
    <>
      <TouchableOpacity style={styles.backButton} onPress={() => setShowProductForm(false)}>
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>➕ Add New Product</Text>
      <Text style={styles.subtitle}>Fill in the details below.</Text>

      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>Product Name *</Text>
        <TextInput
          style={styles.formInput}
          placeholder="e.g., Indomie Super Pack"
          placeholderTextColor="#ADB5BD"
          value={newProduct.name}
          onChangeText={(text) => setNewProduct({ ...newProduct, name: text })}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>Category</Text>
        <View style={styles.categoryRow}>
          {['Noodles', 'Beverages', 'Food', 'Snacks', 'Other'].map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.categoryChip, newProduct.category === cat && styles.categoryChipActive]}
              onPress={() => setNewProduct({ ...newProduct, category: cat })}
            >
              <Text style={[styles.categoryChipText, newProduct.category === cat && styles.categoryChipTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>Price (₦) *</Text>
        <TextInput
          style={styles.formInput}
          placeholder="e.g., 14200"
          placeholderTextColor="#ADB5BD"
          keyboardType="numeric"
          value={newProduct.price}
          onChangeText={(text) => setNewProduct({ ...newProduct, price: text })}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>Size Details</Text>
        <TextInput
          style={styles.formInput}
          placeholder="e.g., 500g, 1kg, 12pcs"
          placeholderTextColor="#ADB5BD"
          value={newProduct.size}
          onChangeText={(text) => setNewProduct({ ...newProduct, size: text })}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>Stock Quantity *</Text>
        <TextInput
          style={styles.formInput}
          placeholder="e.g., 100"
          placeholderTextColor="#ADB5BD"
          keyboardType="numeric"
          value={newProduct.stock}
          onChangeText={(text) => setNewProduct({ ...newProduct, stock: text })}
        />
      </View>

      <TouchableOpacity style={styles.saveButton} onPress={saveNewProduct}>
        <Text style={styles.saveButtonText}>✅ Add Product</Text>
      </TouchableOpacity>
    </>
  );

  // ============================================================
  // RENDER DASHBOARD
  // ============================================================
  const renderDashboard = () => (
    <>
      <Text style={styles.title}>📦 Distributor Dashboard</Text>
      <Text style={styles.subtitle}>Manage orders and inventory.</Text>

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

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🆕 Recent Orders</Text>
        {loading ? (
          <ActivityIndicator size="large" color="#01311F" style={styles.loader} />
        ) : orders.length === 0 ? (
          <Text style={styles.emptyText}>No orders yet.</Text>
        ) : (
          orders.slice(0, 5).map((order, index) => (
            <View key={index} style={styles.orderItem}>
              <TouchableOpacity
                style={{ flex: 1 }}
                onPress={() => handleOrderPress(order)}
              >
                <Text style={styles.orderId}>#{order._id.slice(-6).toUpperCase()}</Text>
                <Text style={styles.orderStatus}>{order.status?.toUpperCase()}</Text>
                <Text style={styles.orderTotal}>₦{order.total?.toLocaleString()}</Text>
              </TouchableOpacity>
              <View style={styles.orderActions}>
                {order.status === 'pending' && (
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => cancelOrder(order)}
                  >
                    <Text style={styles.cancelButtonText}>❌</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.chatButton}
                  onPress={() => openChat(order)}
                >
                  <Text style={styles.chatButtonText}>💬</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>
    </>
  );

  // ============================================================
  // RENDER SETTINGS
  // ============================================================
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {showProductForm
          ? renderProductForm()
          : activeTab === 'dashboard'
            ? renderDashboard()
            : renderSettings()
        }
      </ScrollView>

      {!showProductForm && (
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
      )}

      {/* Chat Modal */}
      {showChat && (
        <Modal visible={showChat} animationType="slide" transparent={false}>
          <SafeAreaView style={styles.chatContainer}>
            <View style={styles.chatHeader}>
              <TouchableOpacity onPress={() => setShowChat(false)}>
                <Text style={styles.chatBack}>← Back</Text>
              </TouchableOpacity>
              <View style={styles.chatHeaderInfo}>
                <Text style={styles.chatHeaderName}>{chatReceiver?.name || 'Chat'}</Text>
                <Text style={styles.chatHeaderRole}>{chatReceiver?.role?.toUpperCase() || ''}</Text>
              </View>
              <View style={{ width: 60 }} />
            </View>

            <ScrollView style={styles.chatMessages} contentContainerStyle={{ padding: 16 }}>
              {chatMessages.length === 0 ? (
                <Text style={styles.chatEmpty}>No messages yet. Start the conversation!</Text>
              ) : (
                chatMessages.map((msg, index) => {
                  const isMe = msg.senderId === user?.id;
                  return (
                    <View key={index} style={[styles.chatBubble, isMe ? styles.chatBubbleMe : styles.chatBubbleThem]}>
                      {!isMe && <Text style={styles.chatBubbleName}>{msg.senderName}</Text>}
                      <Text style={isMe ? styles.chatTextMe : styles.chatTextThem}>{msg.message}</Text>
                      <Text style={styles.chatTime}>
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                  );
                })
              )}
            </ScrollView>

            <View style={styles.chatInputContainer}>
              <TextInput
                style={styles.chatInput}
                placeholder="Type a message..."
                placeholderTextColor="#ADB5BD"
                value={chatInput}
                onChangeText={setChatInput}
                multiline
              />
              <TouchableOpacity style={styles.chatSendButton} onPress={sendMessage} disabled={sendingMessage}>
                {sendingMessage ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.chatSendText}>Send</Text>}
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </Modal>
      )}
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
  confirmedCard: { borderLeftWidth: 4, borderLeftColor: COLORS.confirmed },
  deliveredCard: { borderLeftWidth: 4, borderLeftColor: COLORS.delivered },
  statNumber: { fontSize: 24, fontWeight: '700', color: COLORS.primary },
  statLabel: { fontSize: 12, color: COLORS.gray, marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  card: { flex: 1, minWidth: '45%', backgroundColor: COLORS.white, padding: 20, borderRadius: 12, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardIcon: { fontSize: 32, marginBottom: 8 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: COLORS.primary },
  section: { backgroundColor: COLORS.white, padding: 16, borderRadius: 12, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12, color: COLORS.primary },
  loader: { marginVertical: 20 },
  orderItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  orderId: { fontSize: 14, fontWeight: '600', color: COLORS.primary },
  orderStatus: { fontSize: 12, fontWeight: '600', color: COLORS.gray, marginTop: 2 },
  orderTotal: { fontSize: 14, fontWeight: '700', color: COLORS.primary, marginTop: 2 },
  orderActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chatButton: { backgroundColor: '#6C5CE7', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 },
  chatButtonText: { color: '#FFFFFF', fontSize: 14 },
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
  // Product form
  backButton: { paddingVertical: 8, marginBottom: 8 },
  backButtonText: { color: COLORS.primary, fontSize: 16, fontWeight: '600' },
  formGroup: { marginBottom: 16 },
  formLabel: { fontSize: 14, fontWeight: '600', color: COLORS.primary, marginBottom: 8 },
  formInput: { backgroundColor: COLORS.white, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: COLORS.lightGray, fontSize: 16, color: COLORS.primary },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.lightGray },
  categoryChipActive: { backgroundColor: COLORS.primary },
  categoryChipText: { fontSize: 13, color: COLORS.gray, fontWeight: '500' },
  categoryChipTextActive: { color: COLORS.white },
  saveButton: { backgroundColor: COLORS.primary, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 16 },
  saveButtonText: { color: COLORS.white, fontSize: 16, fontWeight: '600' },
  // Chat
  chatContainer: { flex: 1, backgroundColor: COLORS.background },
  chatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  chatBack: { color: COLORS.primary, fontSize: 16, fontWeight: '600' },
  chatHeaderInfo: { alignItems: 'center' },
  chatHeaderName: { fontSize: 16, fontWeight: '700', color: COLORS.primary },
  chatHeaderRole: { fontSize: 11, color: COLORS.gray, fontWeight: '600' },
  chatMessages: { flex: 1 },
  chatEmpty: { textAlign: 'center', color: COLORS.gray, marginTop: 40 },
  chatBubble: { maxWidth: '80%', padding: 12, borderRadius: 12, marginBottom: 8 },
  chatBubbleMe: { alignSelf: 'flex-end', backgroundColor: COLORS.primary },
  chatBubbleThem: { alignSelf: 'flex-start', backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.lightGray },
  chatBubbleName: { fontSize: 11, fontWeight: '700', color: COLORS.secondary, marginBottom: 4 },
  chatTextMe: { color: COLORS.white, fontSize: 14 },
  chatTextThem: { color: COLORS.primary, fontSize: 14 },
  chatTime: { fontSize: 10, color: COLORS.gray, marginTop: 4, alignSelf: 'flex-end' },
  chatInputContainer: { flexDirection: 'row', padding: 12, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.lightGray, alignItems: 'flex-end' },
  chatInput: { flex: 1, backgroundColor: COLORS.background, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, maxHeight: 100, borderWidth: 1, borderColor: COLORS.lightGray },
  chatSendButton: { marginLeft: 8, backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20 },
  chatSendText: { color: COLORS.white, fontWeight: '700', fontSize: 14 },
});