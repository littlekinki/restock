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
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Rating } from '@kolking/react-native-rating';
import { router } from 'expo-router';

const API_URL = 'https://restock-backend-zkrx.onrender.com/api';

export default function ShopScreen() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Rating state
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [selectedOrderForRating, setSelectedOrderForRating] = useState(null);
  const [distributorRating, setDistributorRating] = useState(0);
  const [distributorReview, setDistributorReview] = useState('');
  const [riderRating, setRiderRating] = useState(0);
  const [riderReview, setRiderReview] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);

  // Chat state
  const [showChat, setShowChat] = useState(false);
  const [chatOrderId, setChatOrderId] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [chatReceiver, setChatReceiver] = useState(null);

  // Dashboard data
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, delivered: 0, spent: 0 });

  // Settings data
  const [profile, setProfile] = useState({
    businessName: '', ownerName: '', phone: '', email: '',
    street: '', city: '', state: '', landmark: '',
  });
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    loadUser();
    loadProducts();
    loadOrders();
  }, []);

  const loadUser = async () => {
    const userData = await AsyncStorage.getItem('user');
    if (userData) setUser(JSON.parse(userData));
  };

  // ============================================================
  // LOAD PRODUCTS
  // ============================================================
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

  // ============================================================
  // LOAD ORDERS
  // ============================================================
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

  // ============================================================
  // LOAD SETTINGS DATA
  // ============================================================
  const loadSettingsData = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const userData = await AsyncStorage.getItem('user');
      const currentUser = JSON.parse(userData);
      const response = await fetch(`${API_URL}/shops`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        const shop = data.shops.find(s => s._id === currentUser.id);
        if (shop) {
          setProfile({
            businessName: shop.businessName || '',
            ownerName: shop.ownerName || '',
            phone: shop.phone || '',
            email: shop.email || '',
            street: shop.address?.street || '',
            city: shop.address?.city || '',
            state: shop.address?.state || '',
            landmark: shop.address?.landmark || '',
          });
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
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

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'settings') loadSettingsData();
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
      const response = await fetch(`${API_URL}/shops/${currentUser.id}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: profile.businessName,
          ownerName: profile.ownerName,
          phone: profile.phone,
          email: profile.email,
          address: {
            street: profile.street, city: profile.city,
            state: profile.state, landmark: profile.landmark,
          }
        })
      });
      const data = await response.json();
      if (data.success) {
        const updatedUser = { ...currentUser, name: profile.businessName, phone: profile.phone };
        await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
        setUser(updatedUser);
        Alert.alert('✅ Success', 'Profile saved successfully!');
      } else {
        Alert.alert('❌ Error', data.error || 'Failed to save profile');
      }
    } catch (error) {
      Alert.alert('❌ Error', 'Could not save profile');
    } finally {
      setSavingProfile(false);
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
          userId: currentUser.id, role: 'shop',
          currentPassword: passwords.current, newPassword: passwords.new
        })
      });
      const data = await response.json();
      if (data.success) {
        Alert.alert('✅ Success', 'Password changed successfully!');
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
  // SUBMIT RATING
  // ============================================================
  const submitRating = async () => {
    if (!distributorRating && !riderRating) {
      Alert.alert('⚠️ Missing Rating', 'Please rate the distributor or rider.');
      return;
    }
    setSubmittingRating(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_URL}/orders/${selectedOrderForRating._id}/rate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          distributorRating: distributorRating || null,
          distributorReview: distributorReview || '',
          riderRating: riderRating || null,
          riderReview: riderReview || ''
        })
      });
      const data = await response.json();
      if (data.success) {
        Alert.alert('✅ Thank You!', 'Your rating has been submitted.');
        setShowRatingModal(false);
        setSelectedOrderForRating(null);
        setDistributorRating(0);
        setDistributorReview('');
        setRiderRating(0);
        setRiderReview('');
        loadOrders();
      } else {
        Alert.alert('❌ Error', data.error || 'Failed to submit rating');
      }
    } catch (error) {
      Alert.alert('❌ Error', 'Could not submit rating');
    } finally {
      setSubmittingRating(false);
    }
  };

  const openRatingModal = (order) => {
    setSelectedOrderForRating(order);
    setDistributorRating(0);
    setDistributorReview('');
    setRiderRating(0);
    setRiderReview('');
    setShowRatingModal(true);
  };

  // ============================================================
  // OPEN CHAT (Shop version - chats with distributor or rider)
  // ============================================================
  const openChat = async (order) => {
    setChatOrderId(order._id);
    setShowChat(true);

    // Shop chats with distributor first, then rider
    if (order.distributorId) {
      setChatReceiver({
        id: order.distributorId._id || order.distributorId,
        role: 'distributor',
        name: order.distributorId?.businessName || 'Distributor'
      });
    } else if (order.riderId) {
      setChatReceiver({
        id: order.riderId._id || order.riderId,
        role: 'rider',
        name: order.riderId?.fullName || 'Rider'
      });
    }

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
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
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

  const trackOrder = (orderId) => {
    router.push(`/tracking?orderId=${orderId}`);
  };

  // ============================================================
  // RENDER DASHBOARD
  // ============================================================
  const renderDashboard = () => (
    <>
      <Text style={styles.title}>🏪 Shop Dashboard</Text>
      <Text style={styles.subtitle}>Welcome to Restock!</Text>

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

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="🔍 Search products..."
          placeholderTextColor="#ADB5BD"
          value={searchTerm}
          onChangeText={setSearchTerm}
        />
      </View>

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
              <View style={styles.orderActions}>
                <TouchableOpacity style={styles.chatButton} onPress={() => openChat(order)}>
                  <Text style={styles.chatButtonText}>💬</Text>
                </TouchableOpacity>
                {order.status === 'delivered' && !order.isRated && (
                  <TouchableOpacity style={styles.rateButton} onPress={() => openRatingModal(order)}>
                    <Text style={styles.rateButtonText}>⭐</Text>
                  </TouchableOpacity>
                )}
                {order.status === 'delivered' && order.isRated && (
                  <Text style={styles.ratedText}>✅</Text>
                )}
                {(order.status === 'picked_up' || order.status === 'out_for_delivery') && (
                  <TouchableOpacity style={styles.trackButton} onPress={() => trackOrder(order._id)}>
                    <Text style={styles.trackButtonText}>📍</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))
        )}
      </View>

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

  // ============================================================
  // CANCEL ORDER
  // ============================================================
  const cancelOrder = async (order) => {
      Alert.prompt(
          '❌ Cancel Order',
          `Why are you cancelling order #${order._id.slice(-6).toUpperCase()}?`,
          [
              { text: 'Never mind', style: 'cancel' },
              {
                  text: 'Cancel Order',
                  style: 'destructive',
                  onPress: async (reason) => {
                      if (!reason || !reason.trim()) {
                        Alert.alert('⚠️ Missing Reason', 'Please provide a reason.');
                        return;
                      }
                      try {
                          const token = await AsyncStorage.getItem('token');
                          const response = await fetch(`${API_URL}/orders/${order._id}/cancel`, {
                              method: 'PATCH',
                              headers: {
                                  'Authorization': `Bearer ${token}`,
                                  'Content-Type': 'application/json'
                              },
                              body: JSON.stringify({ reason: reason.trim() })
                          });
                          const data = await response.json();
                          if (data.success) {
                              Alert.alert('✅ Cancelled', 'Your order has been cancelled.');
                              loadOrders();
                          } else {
                              Alert.alert('❌ Error', data.error || 'Failed to cancel');
                          }
                      } catch (error) {
                          Alert.alert('❌ Error', 'Could not cancel order');
                      }
                  }
              }
          ],
          'plain-text'
      );
  };

  // ============================================================
  // RENDER SETTINGS
  // ============================================================
  const renderSettings = () => (
    <>
      <Text style={styles.title}>⚙️ Settings</Text>
      <Text style={styles.subtitle}>Manage your shop preferences.</Text>

      <View style={styles.settingsCard}>
        <Text style={styles.settingsCardTitle}>👤 Profile Settings</Text>
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
          placeholder="Email address" placeholderTextColor="#ADB5BD" keyboardType="email-address" />
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
        <TouchableOpacity style={styles.saveButton} onPress={saveProfile} disabled={savingProfile}>
          {savingProfile ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveButtonText}>💾 Save Profile</Text>}
        </TouchableOpacity>
      </View>

      <View style={styles.settingsCard}>
        <Text style={styles.settingsCardTitle}>🔒 Change Password</Text>
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

      <View style={[styles.settingsCard, styles.dangerCard]}>
        <Text style={[styles.settingsCardTitle, styles.dangerText]}>⚠️ Danger Zone</Text>
        <Text style={styles.dangerSubtitle}>Once you deactivate your account, there is no going back.</Text>
        <TouchableOpacity style={styles.dangerButton} onPress={() => Alert.alert('Warning', 'Account deactivation coming soon!')}>
          <Text style={styles.dangerButtonText}>🗑️ Deactivate Account</Text>
        </TouchableOpacity>
      </View>
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

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'dashboard' && styles.tabItemActive]}
          onPress={() => handleTabChange('dashboard')}
        >
          <Text style={styles.tabIcon}>📊</Text>
          <Text style={[styles.tabLabel, activeTab === 'dashboard' && styles.tabLabelActive]}>Dashboard</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'settings' && styles.tabItemActive]}
          onPress={() => handleTabChange('settings')}
        >
          <Text style={styles.tabIcon}>⚙️</Text>
          <Text style={[styles.tabLabel, activeTab === 'settings' && styles.tabLabelActive]}>Settings</Text>
        </TouchableOpacity>
      </View>

      {/* Rating Modal */}
      {showRatingModal && selectedOrderForRating && (
        <View style={styles.modalOverlay}>
          <View style={styles.ratingModal}>
            <Text style={styles.ratingTitle}>Rate Your Experience</Text>
            <Text style={styles.ratingSubtitle}>
              Order #{selectedOrderForRating._id.slice(-6).toUpperCase()}
            </Text>
            <View style={styles.ratingSection}>
              <Text style={styles.ratingLabel}>📦 Distributor</Text>
              <Rating size={36} rating={distributorRating} onChange={setDistributorRating} />
              <TextInput style={styles.reviewInput} placeholder="Leave a comment (optional)"
                placeholderTextColor="#ADB5BD" value={distributorReview}
                onChangeText={setDistributorReview} multiline />
            </View>
            <View style={styles.ratingSection}>
              <Text style={styles.ratingLabel}>🏍️ Rider</Text>
              <Rating size={36} rating={riderRating} onChange={setRiderRating} />
              <TextInput style={styles.reviewInput} placeholder="Leave a comment (optional)"
                placeholderTextColor="#ADB5BD" value={riderReview}
                onChangeText={setRiderReview} multiline />
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowRatingModal(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitButton} onPress={submitRating} disabled={submittingRating}>
                {submittingRating ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Submit</Text>}
              </TouchableOpacity>
            </View>
          </View>
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
              <TextInput style={styles.chatInput} placeholder="Type a message..."
                placeholderTextColor="#ADB5BD" value={chatInput}
                onChangeText={setChatInput} multiline />
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
  searchContainer: { marginBottom: 24 },
  searchInput: { backgroundColor: COLORS.white, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: COLORS.lightGray, fontSize: 16, color: COLORS.primary },
  section: { backgroundColor: COLORS.white, padding: 16, borderRadius: 12, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12, color: COLORS.primary },
  loader: { marginVertical: 20 },
  orderItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  orderId: { fontSize: 14, fontWeight: '600', color: COLORS.primary },
  orderStatus: { fontSize: 12, fontWeight: '600', color: COLORS.gray, marginTop: 2 },
  orderTotal: { fontSize: 14, fontWeight: '700', color: COLORS.primary, marginTop: 2 },
  orderActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  trackButton: { backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 },
  trackButtonText: { color: COLORS.white, fontSize: 14 },
  rateButton: { backgroundColor: '#FDCB6E', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 },
  rateButtonText: { color: '#2D3436', fontSize: 14 },
  ratedText: { color: COLORS.secondary, fontSize: 16, fontWeight: '600' },
  chatButton: { backgroundColor: '#6C5CE7', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 },
  chatButtonText: { color: '#FFFFFF', fontSize: 14 },
  productItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  productName: { fontSize: 16, fontWeight: '600', color: COLORS.primary },
  productPrice: { fontSize: 14, fontWeight: '700', color: COLORS.secondary, marginTop: 2 },
  productDistributor: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  emptyText: { color: COLORS.gray, textAlign: 'center', padding: 20 },
  settingsCard: { backgroundColor: COLORS.white, padding: 20, borderRadius: 12, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  settingsCardTitle: { fontSize: 18, fontWeight: '700', color: COLORS.primary, marginBottom: 16 },
  formLabel: { fontSize: 13, fontWeight: '600', color: COLORS.primary, marginBottom: 6, marginTop: 8 },
  formInput: { backgroundColor: COLORS.background, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: COLORS.lightGray, fontSize: 15, color: COLORS.primary },
  formRow: { flexDirection: 'row', gap: 12 },
  formHalf: { flex: 1 },
  passwordRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.background, borderRadius: 10, borderWidth: 1, borderColor: COLORS.lightGray },
  passwordInput: { flex: 1, padding: 14, fontSize: 15, color: COLORS.primary },
  eyeButton: { padding: 14 },
  eyeIcon: { fontSize: 20 },
  saveButton: { backgroundColor: COLORS.primary, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 20 },
  saveButtonText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
  dangerCard: { borderWidth: 1, borderColor: COLORS.danger },
  dangerText: { color: COLORS.danger },
  dangerSubtitle: { fontSize: 13, color: COLORS.gray, marginBottom: 16 },
  dangerButton: { backgroundColor: COLORS.danger, borderRadius: 12, padding: 14, alignItems: 'center' },
  dangerButtonText: { color: COLORS.white, fontSize: 14, fontWeight: '700' },
  tabBar: { flexDirection: 'row', backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.lightGray, paddingVertical: 8, paddingBottom: 20 },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  tabItemActive: { borderTopWidth: 3, borderTopColor: COLORS.primary, marginTop: -11 },
  tabIcon: { fontSize: 24 },
  tabLabel: { fontSize: 12, color: COLORS.gray, marginTop: 4 },
  tabLabelActive: { color: COLORS.primary, fontWeight: '600' },
  // Rating Modal
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  ratingModal: { backgroundColor: COLORS.white, borderRadius: 16, padding: 24, width: '90%', maxWidth: 400 },
  ratingTitle: { fontSize: 20, fontWeight: '800', color: COLORS.primary, textAlign: 'center', marginBottom: 4 },
  ratingSubtitle: { fontSize: 14, color: COLORS.gray, textAlign: 'center', marginBottom: 20 },
  ratingSection: { marginBottom: 20, alignItems: 'center' },
  ratingLabel: { fontSize: 15, fontWeight: '600', color: COLORS.primary, marginBottom: 8 },
  reviewInput: { backgroundColor: COLORS.background, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: COLORS.lightGray, fontSize: 14, color: COLORS.primary, width: '100%', marginTop: 8, minHeight: 60 },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelButton: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: COLORS.lightGray, alignItems: 'center' },
  cancelButtonText: { color: COLORS.gray, fontWeight: '600' },
  submitButton: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: COLORS.primary, alignItems: 'center' },
  submitButtonText: { color: COLORS.white, fontWeight: '700' },
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
  cancelButton: {
    backgroundColor: '#E17055',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
},
cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
},
});