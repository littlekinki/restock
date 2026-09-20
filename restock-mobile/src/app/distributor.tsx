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
  Switch,
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
  const [orderFilter, setOrderFilter] = useState('all');

  // Settings state
  const [profile, setProfile] = useState({
    businessName: '', ownerName: '', phone: '', email: '',
    street: '', city: '', state: '', landmark: '',
    bankName: '', accountNumber: '', accountName: '',
  });
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [savingBank, setSavingBank] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Notification preferences
  const [notifPrefs, setNotifPrefs] = useState({ sms: true, push: true });
  const [savingNotifPrefs, setSavingNotifPrefs] = useState(false);

  // Earnings state
  const [earnings, setEarnings] = useState(null);
  const [showEarningsModal, setShowEarningsModal] = useState(false);

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
    loadEarnings();
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
      const userData = await AsyncStorage.getItem('user');
      const currentUser = JSON.parse(userData);
      const response = await fetch(
        `${API_URL}/orders?distributorId=${currentUser.id}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
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

  // ============================================================
  // LOAD EARNINGS
  // ============================================================
  const loadEarnings = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const userData = await AsyncStorage.getItem('user');
      const currentUser = JSON.parse(userData);
      const response = await fetch(`${API_URL}/distributors/${currentUser.id}/earnings`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setEarnings(data);
      }
    } catch (error) {
      console.error('Load earnings error:', error);
    }
  };

  // ============================================================
  // LOAD SETTINGS DATA
  // ============================================================
  const loadSettingsData = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const userData = await AsyncStorage.getItem('user');
      const currentUser = JSON.parse(userData);

      const response = await fetch(`${API_URL}/distributors`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();

      if (data.success) {
        const d = data.distributors.find(x => x._id === currentUser.id);
        if (d) {
          setProfile({
            businessName: d.businessName || '',
            ownerName: d.ownerName || '',
            phone: d.phone || '',
            email: d.email || '',
            street: d.address?.street || '',
            city: d.address?.city || '',
            state: d.address?.state || '',
            landmark: d.address?.landmark || '',
            bankName: d.bankDetails?.bankName || '',
            accountNumber: d.bankDetails?.accountNumber || '',
            accountName: d.bankDetails?.accountName || '',
          });
          setNotifPrefs({
            sms: d.notificationPrefs?.sms !== false,
            push: d.notificationPrefs?.push !== false,
          });
        }
      }
    } catch (error) {
      console.error('Load settings error:', error);
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
    loadEarnings();
  };

  // ============================================================
  // SAVE PROFILE
  // ============================================================
  const saveProfile = async () => {
    if (!profile.businessName || !profile.ownerName || !profile.phone) {
      Alert.alert('⚠️ Missing Fields', 'Please fill in business name, owner name, and phone.');
      return;
    }
    setSavingProfile(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const userData = await AsyncStorage.getItem('user');
      const currentUser = JSON.parse(userData);
      const response = await fetch(`${API_URL}/distributors/${currentUser.id}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: profile.businessName,
          ownerName: profile.ownerName,
          phone: profile.phone,
          email: profile.email,
        })
      });
      const data = await response.json();
      if (data.success) {
        const updatedUser = { ...currentUser, name: profile.businessName, phone: profile.phone };
        await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
        setUser(updatedUser);
        Alert.alert('✅ Saved', 'Profile updated.');
      } else {
        Alert.alert('❌ Error', data.error || 'Failed to save');
      }
    } catch (error) {
      Alert.alert('❌ Error', 'Could not save profile');
    } finally {
      setSavingProfile(false);
    }
  };

  // ============================================================
  // SAVE ADDRESS
  // ============================================================
  const saveAddress = async () => {
    setSavingAddress(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const userData = await AsyncStorage.getItem('user');
      const currentUser = JSON.parse(userData);
      const response = await fetch(`${API_URL}/distributors/${currentUser.id}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: {
            street: profile.street,
            city: profile.city,
            state: profile.state,
            landmark: profile.landmark,
          }
        })
      });
      const data = await response.json();
      if (data.success) {
        Alert.alert('✅ Saved', 'Address updated.');
      } else {
        Alert.alert('❌ Error', data.error || 'Failed to save');
      }
    } catch (error) {
      Alert.alert('❌ Error', 'Could not save address');
    } finally {
      setSavingAddress(false);
    }
  };

  // ============================================================
  // SAVE BANK DETAILS
  // ============================================================
  const saveBankDetails = async () => {
    setSavingBank(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const userData = await AsyncStorage.getItem('user');
      const currentUser = JSON.parse(userData);
      const response = await fetch(`${API_URL}/distributors/${currentUser.id}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bankDetails: {
            bankName: profile.bankName,
            accountNumber: profile.accountNumber,
            accountName: profile.accountName,
          }
        })
      });
      const data = await response.json();
      if (data.success) {
        Alert.alert('✅ Saved', 'Bank details updated.');
      } else {
        Alert.alert('❌ Error', data.error || 'Failed to save');
      }
    } catch (error) {
      Alert.alert('❌ Error', 'Could not save bank details');
    } finally {
      setSavingBank(false);
    }
  };

  // ============================================================
  // SAVE NOTIFICATION PREFERENCES
  // ============================================================
  const saveNotifPrefs = async () => {
    setSavingNotifPrefs(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const userData = await AsyncStorage.getItem('user');
      const currentUser = JSON.parse(userData);
      const response = await fetch(`${API_URL}/distributors/${currentUser.id}/notification-prefs`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sms: notifPrefs.sms, push: notifPrefs.push })
      });
      const data = await response.json();
      if (data.success) {
        Alert.alert('✅ Saved', 'Notification preferences updated.');
      } else {
        Alert.alert('❌ Error', data.error || 'Failed to save');
      }
    } catch (error) {
      Alert.alert('❌ Error', 'Could not save preferences');
    } finally {
      setSavingNotifPrefs(false);
    }
  };

  // ============================================================
  // CHANGE PASSWORD
  // ============================================================
  const changePassword = async () => {
    if (!passwords.current || !passwords.new || !passwords.confirm) {
      Alert.alert('⚠️ Missing Fields', 'Please fill in all password fields.');
      return;
    }
    if (passwords.new !== passwords.confirm) {
      Alert.alert('⚠️ Error', 'New passwords do not match.');
      return;
    }
    if (passwords.new.length < 6) {
      Alert.alert('⚠️ Error', 'Password must be at least 6 characters.');
      return;
    }
    setSavingPassword(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const userData = await AsyncStorage.getItem('user');
      const currentUser = JSON.parse(userData);
      const response = await fetch(`${API_URL}/auth/change-password`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          role: 'distributor',
          currentPassword: passwords.current,
          newPassword: passwords.new
        })
      });
      const data = await response.json();
      if (data.success) {
        Alert.alert('✅ Success', 'Password changed!');
        setPasswords({ current: '', new: '', confirm: '' });
      } else {
        Alert.alert('❌ Error', data.error || 'Failed to change password');
      }
    } catch (error) {
      Alert.alert('❌ Error', 'Could not change password');
    } finally {
      setSavingPassword(false);
    }
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
  const renderDashboard = () => {
    const visibleOrders = orderFilter === 'all'
      ? orders
      : orders.filter(o => o.status === orderFilter);

    const toggleFilter = (filter) => {
      if (orderFilter === filter) setOrderFilter('all');
      else setOrderFilter(filter);
    };

    const itemsSummary = (order) => {
      const items = order.items || [];
      const names = items.slice(0, 2).map(
        i => `${i.productName} × ${i.quantity}`
      );
      const extra = items.length - 2;
      return names.join(', ') + (extra > 0 ? `  +${extra} more` : '');
    };

    const actionHint = (order) => {
      if (order.status === 'pending') return '👉 Tap to confirm order';
      if (order.status === 'confirmed') return '👉 Tap to assign rider';
      if (order.status === 'picked_up' || order.status === 'out_for_delivery')
        return `🏍️ ${order.riderId?.fullName || 'Rider assigned'}`;
      if (order.status === 'delivered') return '✅ Delivered';
      if (order.status === 'cancelled') return '❌ Cancelled';
      return '';
    };

    return (
      <>
        <Text style={styles.title}>📦 Distributor Dashboard</Text>
        <Text style={styles.subtitle}>Manage orders and inventory.</Text>

        {/* Stats — now tappable */}
        <View style={styles.statsGrid}>
          <TouchableOpacity
            style={[
              styles.statCard,
              orderFilter === 'all' && styles.statCardActive,
            ]}
            onPress={() => setOrderFilter('all')}
          >
            <Text style={styles.statNumber}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total Orders</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.statCard,
              styles.pendingCard,
              orderFilter === 'pending' && styles.statCardActive,
            ]}
            onPress={() => toggleFilter('pending')}
          >
            <Text style={styles.statNumber}>{stats.pending}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.statCard,
              styles.confirmedCard,
              orderFilter === 'confirmed' && styles.statCardActive,
            ]}
            onPress={() => toggleFilter('confirmed')}
          >
            <Text style={styles.statNumber}>{stats.confirmed}</Text>
            <Text style={styles.statLabel}>Confirmed</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.statCard,
              styles.deliveredCard,
              orderFilter === 'delivered' && styles.statCardActive,
            ]}
            onPress={() => toggleFilter('delivered')}
          >
            <Text style={styles.statNumber}>{stats.delivered}</Text>
            <Text style={styles.statLabel}>Delivered</Text>
          </TouchableOpacity>
        </View>

        {/* 💰 Earnings card */}
        {earnings && (
          <TouchableOpacity
            style={styles.earningsCard}
            onPress={() => setShowEarningsModal(true)}
          >
            <View style={styles.earningsHeader}>
              <Text style={styles.earningsTitle}>💰 My Earnings</Text>
              <Text style={styles.earningsArrow}>→</Text>
            </View>

            <Text style={styles.earningsBig}>
              ₦{(earnings.summary.monthRevenue || 0).toLocaleString()}
            </Text>
            <Text style={styles.earningsLabel}>This month</Text>

            <View style={styles.earningsRow}>
              <View style={styles.earningsStat}>
                <Text style={styles.earningsStatLabel}>✅ Delivered</Text>
                <Text style={styles.earningsStatValue}>
                  ₦{(earnings.summary.deliveredRevenue || 0).toLocaleString()}
                </Text>
              </View>
              <View style={styles.earningsStat}>
                <Text style={styles.earningsStatLabel}>📦 Cartons</Text>
                <Text style={styles.earningsStatValue}>
                  {earnings.summary.totalCartons || 0}
                </Text>
              </View>
            </View>

            <Text style={styles.earningsTapHint}>Tap for full breakdown →</Text>
          </TouchableOpacity>
        )}

        {/* Quick actions grid — same as before */}
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

          <TouchableOpacity
            style={styles.card}
            onPress={() => { setActiveTab('settings'); loadSettingsData(); }}
          >
            <Text style={styles.cardIcon}>⚙️</Text>
            <Text style={styles.cardTitle}>Settings</Text>
          </TouchableOpacity>
        </View>

        {/* Orders section — filtered */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>
              {orderFilter === 'all' ? '🆕 All Orders' : `🆕 ${orderFilter.toUpperCase()} Orders`}
            </Text>
            {orderFilter !== 'all' && (
              <TouchableOpacity onPress={() => setOrderFilter('all')}>
                <Text style={styles.showAllText}>Show all</Text>
              </TouchableOpacity>
            )}
          </View>

          {loading ? (
            <ActivityIndicator size="large" color="#01311F" style={styles.loader} />
          ) : visibleOrders.length === 0 ? (
            <Text style={styles.emptyText}>
              {orderFilter === 'all' ? 'No orders yet.' : `No ${orderFilter} orders.`}
            </Text>
          ) : (
            visibleOrders.slice(0, 20).map((order, index) => (
              <View key={index} style={styles.orderItem}>
                <TouchableOpacity
                  style={{ flex: 1 }}
                  onPress={() => handleOrderPress(order)}
                >
                  <Text style={styles.orderId}>#{order._id.slice(-6).toUpperCase()}</Text>
                  <Text style={styles.orderItemsText}>{itemsSummary(order)}</Text>
                  <View style={styles.orderStatusRow}>
                    <View style={[styles.statusPill, { backgroundColor: statusBg(order.status) }]}>
                      <Text style={[styles.statusPillText, { color: statusColor(order.status) }]}>
                        {order.status?.toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.orderTotal}>₦{order.total?.toLocaleString()}</Text>
                  </View>
                  <Text style={styles.actionHint}>{actionHint(order)}</Text>
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
  };

  // Helpers for status colors
  const statusColor = (status) => {
    if (status === 'delivered') return '#1B5E20';
    if (status === 'pending') return '#E65100';
    if (status === 'cancelled') return '#C62828';
    if (status === 'confirmed') return '#0D47A1';
    return '#6C757D';
  };

  const statusBg = (status) => {
    if (status === 'delivered') return '#E8F5E9';
    if (status === 'pending') return '#FFF3E0';
    if (status === 'cancelled') return '#FFEBEE';
    if (status === 'confirmed') return '#E3F2FD';
    return '#F1F3F5';
  };

  // ============================================================
  // RENDER SETTINGS
  // ============================================================
  const renderSettings = () => (
    <>
      <Text style={styles.title}>⚙️ Settings</Text>
      <Text style={styles.subtitle}>Manage your account preferences.</Text>

      {/* 🔔 Notification Preferences */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔔 Notification Preferences</Text>

        <View style={styles.notifRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.notifLabel}>SMS Notifications</Text>
            <Text style={styles.notifHint}>Receive new order updates via SMS</Text>
          </View>
          <Switch
            value={notifPrefs.sms}
            onValueChange={(val) => setNotifPrefs({ ...notifPrefs, sms: val })}
            trackColor={{ false: '#DEE2E6', true: '#4DBE18' }}
            thumbColor="#FFFFFF"
          />
        </View>

        <View style={styles.notifRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.notifLabel}>Push Notifications</Text>
            <Text style={styles.notifHint}>Receive new order alerts in the app</Text>
          </View>
          <Switch
            value={notifPrefs.push}
            onValueChange={(val) => setNotifPrefs({ ...notifPrefs, push: val })}
            trackColor={{ false: '#DEE2E6', true: '#4DBE18' }}
            thumbColor="#FFFFFF"
          />
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={saveNotifPrefs} disabled={savingNotifPrefs}>
          {savingNotifPrefs ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveButtonText}>💾 Save Preferences</Text>}
        </TouchableOpacity>
      </View>

      {/* 👤 Profile */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>👤 Profile Settings</Text>
        <Text style={styles.formLabel}>Business Name</Text>
        <TextInput style={styles.formInput} value={profile.businessName}
          onChangeText={(text) => setProfile({ ...profile, businessName: text })}
          placeholder="Business name" placeholderTextColor="#ADB5BD" />
        <Text style={styles.formLabel}>Owner Name</Text>
        <TextInput style={styles.formInput} value={profile.ownerName}
          onChangeText={(text) => setProfile({ ...profile, ownerName: text })}
          placeholder="Owner name" placeholderTextColor="#ADB5BD" />
        <Text style={styles.formLabel}>Phone Number</Text>
        <TextInput style={styles.formInput} value={profile.phone}
          onChangeText={(text) => setProfile({ ...profile, phone: text })}
          placeholder="Phone number" placeholderTextColor="#ADB5BD" keyboardType="phone-pad" />
        <Text style={styles.formLabel}>Email</Text>
        <TextInput style={styles.formInput} value={profile.email}
          onChangeText={(text) => setProfile({ ...profile, email: text })}
          placeholder="Email" placeholderTextColor="#ADB5BD" keyboardType="email-address" />
        <TouchableOpacity style={styles.saveButton} onPress={saveProfile} disabled={savingProfile}>
          {savingProfile ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveButtonText}>💾 Save Profile</Text>}
        </TouchableOpacity>
      </View>

      {/* 📍 Address */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📍 Address Settings</Text>
        <Text style={styles.formLabel}>Street Address</Text>
        <TextInput style={styles.formInput} value={profile.street}
          onChangeText={(text) => setProfile({ ...profile, street: text })}
          placeholder="Street address" placeholderTextColor="#ADB5BD" />
        <View style={styles.formRow}>
          <View style={styles.formHalf}>
            <Text style={styles.formLabel}>City</Text>
            <TextInput style={styles.formInput} value={profile.city}
              onChangeText={(text) => setProfile({ ...profile, city: text })}
              placeholder="City" placeholderTextColor="#ADB5BD" />
          </View>
          <View style={styles.formHalf}>
            <Text style={styles.formLabel}>State</Text>
            <TextInput style={styles.formInput} value={profile.state}
              onChangeText={(text) => setProfile({ ...profile, state: text })}
              placeholder="State" placeholderTextColor="#ADB5BD" />
          </View>
        </View>
        <Text style={styles.formLabel}>Landmark</Text>
        <TextInput style={styles.formInput} value={profile.landmark}
          onChangeText={(text) => setProfile({ ...profile, landmark: text })}
          placeholder="Landmark" placeholderTextColor="#ADB5BD" />
        <TouchableOpacity style={styles.saveButton} onPress={saveAddress} disabled={savingAddress}>
          {savingAddress ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveButtonText}>💾 Save Address</Text>}
        </TouchableOpacity>
      </View>

      {/* 🔒 Change Password */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔒 Change Password</Text>
        <Text style={styles.formLabel}>Current Password</Text>
        <TextInput style={styles.formInput} value={passwords.current}
          onChangeText={(text) => setPasswords({ ...passwords, current: text })}
          placeholder="Current password" placeholderTextColor="#ADB5BD" secureTextEntry={!showPassword} />
        <Text style={styles.formLabel}>New Password</Text>
        <TextInput style={styles.formInput} value={passwords.new}
          onChangeText={(text) => setPasswords({ ...passwords, new: text })}
          placeholder="New password" placeholderTextColor="#ADB5BD" secureTextEntry={!showPassword} />
        <Text style={styles.formLabel}>Confirm New Password</Text>
        <View style={styles.passwordRow}>
          <TextInput style={styles.passwordInput} value={passwords.confirm}
            onChangeText={(text) => setPasswords({ ...passwords, confirm: text })}
            placeholder="Confirm new password" placeholderTextColor="#ADB5BD" secureTextEntry={!showPassword} />
          <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPassword(!showPassword)}>
            <Text style={styles.eyeIcon}>{showPassword ? '👁️' : '🙈'}</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.saveButton} onPress={changePassword} disabled={savingPassword}>
          {savingPassword ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveButtonText}>🔒 Change Password</Text>}
        </TouchableOpacity>
      </View>

      {/* 💰 Payment */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>💰 Payment Settings</Text>
        <Text style={styles.formLabel}>Bank Name</Text>
        <TextInput style={styles.formInput} value={profile.bankName}
          onChangeText={(text) => setProfile({ ...profile, bankName: text })}
          placeholder="e.g., GTBank" placeholderTextColor="#ADB5BD" />
        <Text style={styles.formLabel}>Account Number</Text>
        <TextInput style={styles.formInput} value={profile.accountNumber}
          onChangeText={(text) => setProfile({ ...profile, accountNumber: text })}
          placeholder="e.g., 0123456789" placeholderTextColor="#ADB5BD" keyboardType="numeric" />
        <Text style={styles.formLabel}>Account Name</Text>
        <TextInput style={styles.formInput} value={profile.accountName}
          onChangeText={(text) => setProfile({ ...profile, accountName: text })}
          placeholder="e.g., Emeka Okafor" placeholderTextColor="#ADB5BD" />
        <TouchableOpacity style={styles.saveButton} onPress={saveBankDetails} disabled={savingBank}>
          {savingBank ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveButtonText}>💾 Save Payment Details</Text>}
        </TouchableOpacity>
      </View>

      {/* ⚠️ Danger Zone */}
      <View style={[styles.section, styles.dangerItem]}>
        <Text style={[styles.sectionTitle, styles.dangerText]}>⚠️ Danger Zone</Text>
        <Text style={styles.dangerSubtitle}>Once you deactivate your account, there is no going back.</Text>
        <TouchableOpacity
          style={styles.dangerButton}
          onPress={() => Alert.alert('Warning', 'Account deactivation coming soon!')}
        >
          <Text style={styles.dangerButtonText}>🗑️ Deactivate Account</Text>
        </TouchableOpacity>
      </View>
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
            onPress={() => { setActiveTab('settings'); loadSettingsData(); }}
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

      {/* Earnings Modal */}
      {showEarningsModal && earnings && (
        <Modal visible={showEarningsModal} animationType="slide" transparent={false}>
          <SafeAreaView style={styles.chatContainer}>
            <View style={styles.chatHeader}>
              <TouchableOpacity onPress={() => setShowEarningsModal(false)}>
                <Text style={styles.chatBack}>← Back</Text>
              </TouchableOpacity>
              <View style={styles.chatHeaderInfo}>
                <Text style={styles.chatHeaderName}>💰 My Earnings</Text>
                <Text style={styles.chatHeaderRole}>Full breakdown</Text>
              </View>
              <View style={{ width: 60 }} />
            </View>

            <ScrollView contentContainerStyle={{ padding: 16 }}>
              {/* Revenue cards */}
              <View style={styles.earnModalRow}>
                <View style={[styles.earnModalCard, { borderLeftColor: '#1B5E20' }]}>
                  <Text style={styles.earnModalLabel}>💰 Total Revenue</Text>
                  <Text style={styles.earnModalValue}>
                    ₦{(earnings.summary.totalRevenue || 0).toLocaleString()}
                  </Text>
                  <Text style={styles.earnModalHint}>{earnings.summary.totalOrders} orders</Text>
                </View>
                <View style={[styles.earnModalCard, { borderLeftColor: '#0D47A1' }]}>
                  <Text style={styles.earnModalLabel}>✅ Delivered</Text>
                  <Text style={styles.earnModalValue}>
                    ₦{(earnings.summary.deliveredRevenue || 0).toLocaleString()}
                  </Text>
                  <Text style={styles.earnModalHint}>{earnings.summary.deliveredCount} delivered</Text>
                </View>
              </View>

              <View style={styles.earnModalRow}>
                <View style={[styles.earnModalCard, { borderLeftColor: '#E65100' }]}>
                  <Text style={styles.earnModalLabel}>⏳ Pending</Text>
                  <Text style={styles.earnModalValue}>
                    ₦{(earnings.summary.pendingRevenue || 0).toLocaleString()}
                  </Text>
                  <Text style={styles.earnModalHint}>
                    {earnings.summary.pendingCount + earnings.summary.confirmedCount + earnings.summary.inTransitCount} in progress
                  </Text>
                </View>
                <View style={[styles.earnModalCard, { borderLeftColor: '#6A1B9A' }]}>
                  <Text style={styles.earnModalLabel}>📦 Cartons</Text>
                  <Text style={styles.earnModalValue}>{earnings.summary.totalCartons || 0}</Text>
                  <Text style={styles.earnModalHint}>{earnings.summary.deliveredCartons} delivered</Text>
                </View>
              </View>

              <View style={styles.earnModalRow}>
                <View style={[styles.earnModalCard, { borderLeftColor: '#00838F' }]}>
                  <Text style={styles.earnModalLabel}>📅 This Month</Text>
                  <Text style={styles.earnModalValue}>
                    ₦{(earnings.summary.monthRevenue || 0).toLocaleString()}
                  </Text>
                  <Text style={styles.earnModalHint}>Since 1st</Text>
                </View>
                <View style={[styles.earnModalCard, { borderLeftColor: '#6C757D' }]}>
                  <Text style={styles.earnModalLabel}>📊 Avg Order</Text>
                  <Text style={styles.earnModalValue}>
                    ₦{(earnings.summary.avgOrderValue || 0).toLocaleString()}
                  </Text>
                  <Text style={styles.earnModalHint}>per order</Text>
                </View>
              </View>

              {/* Orders list */}
              <Text style={[styles.sectionTitle, { marginTop: 24 }]}>📋 Order Breakdown</Text>

              {earnings.breakdown.length === 0 ? (
                <Text style={styles.emptyText}>No orders yet.</Text>
              ) : (
                earnings.breakdown.map((o, idx) => (
                  <View key={idx} style={styles.earnOrderRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.earnOrderId}>{o.orderId}</Text>
                      <Text style={styles.earnOrderShop}>{o.shopName}</Text>
                      <Text style={styles.earnOrderMeta}>
                        {o.cartons} carton{o.cartons === 1 ? '' : 's'} • {o.status?.toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.earnOrderTotal}>
                        ₦{(o.total || 0).toLocaleString()}
                      </Text>
                      <Text style={[
                        styles.earnPaidBadge,
                        o.paidToDistributor ? styles.earnPaidBadgeYes : styles.earnPaidBadgeNo,
                      ]}>
                        {o.paidToDistributor ? '✅ PAID' : '⏳ PENDING'}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
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
  cancelButton: { backgroundColor: '#E17055', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 },
  cancelButtonText: { color: '#FFFFFF', fontSize: 14 },
  emptyText: { color: COLORS.gray, textAlign: 'center', padding: 20 },
  dangerItem: { borderWidth: 1, borderColor: COLORS.danger },
  dangerText: { color: COLORS.danger },
  dangerSubtitle: { fontSize: 13, color: COLORS.gray, marginBottom: 16 },
  dangerButton: { backgroundColor: COLORS.danger, borderRadius: 12, padding: 14, alignItems: 'center' },
  dangerButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
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
  formLabel: { fontSize: 13, fontWeight: '600', color: COLORS.primary, marginBottom: 6, marginTop: 8 },
  formInput: { backgroundColor: COLORS.background, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: COLORS.lightGray, fontSize: 15, color: COLORS.primary },
  formRow: { flexDirection: 'row', gap: 12 },
  formHalf: { flex: 1 },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.lightGray },
  categoryChipActive: { backgroundColor: COLORS.primary },
  categoryChipText: { fontSize: 13, color: COLORS.gray, fontWeight: '500' },
  categoryChipTextActive: { color: COLORS.white },
  saveButton: { backgroundColor: COLORS.primary, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 16 },
  saveButtonText: { color: COLORS.white, fontSize: 15, fontWeight: '600' },
  // Notification preferences
  notifRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  notifLabel: { fontSize: 15, fontWeight: '600', color: COLORS.primary },
  notifHint: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  // Password row
  passwordRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.background, borderRadius: 10, borderWidth: 1, borderColor: COLORS.lightGray },
  passwordInput: { flex: 1, padding: 14, fontSize: 15, color: COLORS.primary },
  eyeButton: { padding: 14 },
  eyeIcon: { fontSize: 20 },
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
    // Enhanced order row
  orderItemsText: { fontSize: 13, color: COLORS.gray, marginTop: 4 },
  orderStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  actionHint: {
    fontSize: 12,
    color: COLORS.secondary,
    fontWeight: '600',
    marginTop: 6,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  showAllText: {
    fontSize: 13,
    color: COLORS.secondary,
    fontWeight: '600',
  },
  statCardActive: {
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
    // Earnings card (dashboard)
  earningsCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  earningsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  earningsTitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    fontWeight: '700',
  },
  earningsArrow: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  earningsBig: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 2,
  },
  earningsLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginBottom: 16,
  },
  earningsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  earningsStat: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    padding: 10,
  },
  earningsStatLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    marginBottom: 4,
  },
  earningsStatValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  earningsTapHint: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    textAlign: 'right',
  },
  // Earnings modal
  earnModalRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  earnModalCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    padding: 14,
    borderRadius: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  earnModalLabel: {
    fontSize: 11,
    color: COLORS.gray,
    fontWeight: '600',
    marginBottom: 4,
  },
  earnModalValue: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.primary,
  },
  earnModalHint: {
    fontSize: 11,
    color: COLORS.gray,
    marginTop: 4,
  },
  earnOrderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  earnOrderId: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  earnOrderShop: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 2,
  },
  earnOrderMeta: {
    fontSize: 11,
    color: COLORS.gray,
    marginTop: 4,
  },
  earnOrderTotal: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 4,
  },
  earnPaidBadge: {
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
  },
  earnPaidBadgeYes: {
    backgroundColor: '#E8F5E9',
    color: '#1B5E20',
  },
  earnPaidBadgeNo: {
    backgroundColor: '#FFF3E0',
    color: '#E65100',
  },
});