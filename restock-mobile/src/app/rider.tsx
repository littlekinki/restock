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
import * as Location from 'expo-location';

const API_URL = 'https://restock-backend-zkrx.onrender.com/api';

const BANK_DETAILS = {
  bankName: process.env.EXPO_PUBLIC_BANK_NAME || 'GTBank',
  accountNumber: process.env.EXPO_PUBLIC_BANK_ACCOUNT || '0123456789',
  accountName: process.env.EXPO_PUBLIC_BANK_ACCOUNT_NAME || 'Restock / Morwave',
};

export default function RiderScreen() {
  const [user, setUser] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState({ total: 0, pending: 0, completed: 0 });

  // Delivery action state
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [showPinEntry, setShowPinEntry] = useState(false);
  const [pin, setPin] = useState('');

  // Settings state
  const [profile, setProfile] = useState({
    fullName: '', phone: '', email: '',
    vehicleType: 'motorcycle', vehiclePlate: '',
    city: '', state: '', radius: '10',
    bankName: '', accountNumber: '', accountName: '',
  });
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingVehicle, setSavingVehicle] = useState(false);
  const [savingService, setSavingService] = useState(false);
  const [savingBank, setSavingBank] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Notification preferences
  const [notifPrefs, setNotifPrefs] = useState({ sms: true, push: true });
  const [savingNotifPrefs, setSavingNotifPrefs] = useState(false);

  // Chat state
  const [showChat, setShowChat] = useState(false);
  const [chatOrderId, setChatOrderId] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [chatReceiver, setChatReceiver] = useState(null);

  // Notifications
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [loadingNotifs, setLoadingNotifs] = useState(false);

  useEffect(() => {
    loadUser();
    loadDeliveries();
    startLocationUpdates();
    loadUnreadCount();

    const interval = setInterval(loadUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadUser = async () => {
    const userData = await AsyncStorage.getItem('user');
    if (userData) setUser(JSON.parse(userData));
  };

  // ============================================================
  // LOAD DELIVERIES
  // ============================================================
  const loadDeliveries = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const userData = await AsyncStorage.getItem('user');
      const currentUser = JSON.parse(userData);
      const response = await fetch(`${API_URL}/orders?riderId=${currentUser?.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setDeliveries(data.orders || []);
        const total = data.orders.length;
        const pending = data.orders.filter(o => o.status === 'picked_up' || o.status === 'out_for_delivery').length;
        const completed = data.orders.filter(o => o.status === 'delivered').length;
        setStats({ total, pending, completed });
      }
    } catch (error) {
      console.error('Error loading deliveries:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // ============================================================
  // LOCATION UPDATES
  // ============================================================
  const updateLocation = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({});
      const token = await AsyncStorage.getItem('token');
      await fetch(`${API_URL}/riders/${user?.id}/location`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: location.coords.latitude, lng: location.coords.longitude }),
      });
    } catch (error) {
      console.error('Error updating location:', error);
    }
  };

  const startLocationUpdates = () => {
    const interval = setInterval(() => { if (user?.id) updateLocation(); }, 10000);
    return () => clearInterval(interval);
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    router.replace('/');
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadDeliveries();
    loadUnreadCount();
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'settings') loadSettingsData();
  };

  // ============================================================
  // LOAD SETTINGS DATA
  // ============================================================
  const loadSettingsData = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const userData = await AsyncStorage.getItem('user');
      const currentUser = JSON.parse(userData);

      const response = await fetch(`${API_URL}/riders`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();

      if (data.success) {
        const rider = data.riders.find(r => r._id === currentUser.id);
        if (rider) {
          setProfile({
            fullName: rider.fullName || '',
            phone: rider.phone || '',
            email: rider.email || '',
            vehicleType: rider.vehicleType || 'motorcycle',
            vehiclePlate: rider.vehiclePlate || '',
            city: rider.currentLocation?.city || '',
            state: rider.currentLocation?.state || '',
            radius: String(rider.serviceArea?.radius || 10),
            bankName: rider.bankDetails?.bankName || '',
            accountNumber: rider.bankDetails?.accountNumber || '',
            accountName: rider.bankDetails?.accountName || '',
          });
          setNotifPrefs({
            sms: rider.notificationPrefs?.sms !== false,
            push: rider.notificationPrefs?.push !== false,
          });
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };



  // ============================================================
  // SAVE PROFILE
  // ============================================================
  const saveProfile = async () => {
    if (!profile.fullName || !profile.phone) {
      Alert.alert('⚠️ Missing Fields', 'Please fill in full name and phone.');
      return;
    }
    setSavingProfile(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const userData = await AsyncStorage.getItem('user');
      const currentUser = JSON.parse(userData);
      const response = await fetch(`${API_URL}/riders/${currentUser.id}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: profile.fullName,
          phone: profile.phone,
          email: profile.email,
        })
      });
      const data = await response.json();
      if (data.success) {
        const updatedUser = { ...currentUser, name: profile.fullName, phone: profile.phone };
        await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
        setUser(updatedUser);
        Alert.alert('✅ Success', 'Profile saved!');
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
  // SAVE VEHICLE
  // ============================================================
  const saveVehicle = async () => {
    setSavingVehicle(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const userData = await AsyncStorage.getItem('user');
      const currentUser = JSON.parse(userData);
      const response = await fetch(`${API_URL}/riders/${currentUser.id}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleType: profile.vehicleType,
          vehiclePlate: profile.vehiclePlate,
        })
      });
      const data = await response.json();
      if (data.success) {
        Alert.alert('✅ Success', 'Vehicle details saved!');
      } else {
        Alert.alert('❌ Error', data.error || 'Failed to save');
      }
    } catch (error) {
      Alert.alert('❌ Error', 'Could not save vehicle');
    } finally {
      setSavingVehicle(false);
    }
  };

  // ============================================================
  // SAVE SERVICE AREA
  // ============================================================
  const saveServiceArea = async () => {
    setSavingService(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const userData = await AsyncStorage.getItem('user');
      const currentUser = JSON.parse(userData);
      const response = await fetch(`${API_URL}/riders/${currentUser.id}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentLocation: {
            city: profile.city,
            state: profile.state,
          },
          serviceArea: {
            city: profile.city,
            state: profile.state,
            radius: parseInt(profile.radius) || 10,
          }
        })
      });
      const data = await response.json();
      if (data.success) {
        Alert.alert('✅ Success', 'Service area saved!');
      } else {
        Alert.alert('❌ Error', data.error || 'Failed to save');
      }
    } catch (error) {
      Alert.alert('❌ Error', 'Could not save service area');
    } finally {
      setSavingService(false);
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
      const response = await fetch(`${API_URL}/riders/${currentUser.id}`, {
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
        Alert.alert('✅ Success', 'Bank details saved!');
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
      const response = await fetch(`${API_URL}/riders/${currentUser.id}/notification-prefs`, {
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
          role: 'rider',
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
  // HANDLE DELIVERY
  // ============================================================
  const handleDeliveryPress = (delivery) => {
    const deliveryAddress = delivery.shopId?.address;
    const pickupAddress = delivery.distributorId?.address;

    const buttons = [];

    if (delivery.status === 'confirmed') {
      buttons.push({ text: '📦 Pick Up', onPress: () => pickupOrder(delivery._id) });
    } else if (delivery.status === 'picked_up' || delivery.status === 'out_for_delivery') {
      buttons.push({ text: '🔑 Enter PIN', onPress: () => openPinEntry(delivery._id) });
    }

    buttons.push({ text: 'Close', style: 'cancel' });

    Alert.alert(
      `📦 Order #${delivery._id.slice(-6).toUpperCase()}`,
      `📥 Pickup: ${pickupAddress?.street || 'N/A'}, ${pickupAddress?.city || ''}\n\n` +
      `📦 Deliver: ${deliveryAddress?.street || 'N/A'}, ${deliveryAddress?.city || ''}\n\n` +
      `💰 Total: ₦${delivery.total?.toLocaleString()}\n\n` +
      `🏦 PAYMENT DETAILS\nBank: ${BANK_DETAILS.bankName}\nAccount: ${BANK_DETAILS.accountNumber}\nName: ${BANK_DETAILS.accountName}`,
      buttons
    );
  };

  const pickupOrder = async (orderId) => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_URL}/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'out_for_delivery', note: 'Rider picked up order' })
      });
      const data = await response.json();
      if (data.success) {
        Alert.alert('✅ Picked Up', 'Order is now out for delivery!');
        loadDeliveries();
      }
    } catch (error) {
      Alert.alert('❌ Error', 'Could not pick up order');
    }
  };

  const openPinEntry = (orderId) => {
    setSelectedDelivery(orderId);
    setPin('');
    setShowPinEntry(true);
  };

  const verifyPinAndDeliver = async () => {
    if (!pin || pin.length !== 4) {
      Alert.alert('⚠️ Invalid PIN', 'Please enter the 4-digit PIN.');
      return;
    }
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_URL}/orders/${selectedDelivery}/verify-pin`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });
      const data = await response.json();
      if (data.success) {
        Alert.alert('✅ Delivered!', 'Order marked as delivered!');
        setShowPinEntry(false);
        setPin('');
        setSelectedDelivery(null);
        loadDeliveries();
      } else {
        Alert.alert('❌ Invalid PIN', data.error || 'Check the PIN and try again.');
        setPin('');
      }
    } catch (error) {
      Alert.alert('❌ Error', 'Could not verify PIN');
    }
  };

    // ============================================================
  // NOTIFICATIONS
  // ============================================================
  const loadNotifications = async () => {
    try {
      setLoadingNotifs(true);
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_URL}/notifications?limit=50`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error('Load notifications error:', error);
    } finally {
      setLoadingNotifs(false);
    }
  };

  const loadUnreadCount = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_URL}/notifications/unread-count`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) setUnreadCount(data.unreadCount || 0);
    } catch (error) {
      console.error('Unread count error:', error);
    }
  };

  const markNotificationRead = async (notif) => {
    try {
      const token = await AsyncStorage.getItem('token');
      await fetch(`${API_URL}/notifications/${notif._id}/read`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      setNotifications(prev => prev.map(n =>
        n._id === notif._id ? { ...n, read: true } : n
      ));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Mark read error:', error);
    }
  };

  const markAllNotificationsRead = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      await fetch(`${API_URL}/notifications/read-all`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Mark all read error:', error);
    }
  };

  const openNotifications = async () => {
    setShowNotificationsModal(true);
    await loadNotifications();
  };

  const handleNotificationPress = async (notif) => {
    if (!notif.read) await markNotificationRead(notif);
    setShowNotificationsModal(false);
  };

  const timeAgo = (dateStr) => {
    const seconds = Math.floor((new Date() - new Date(dateStr)) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  // ============================================================
  // OPEN CHAT (Rider chats with Shop)
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

  // ============================================================
  // RENDER PIN ENTRY
  // ============================================================
  const renderPinEntry = () => (
    <>
      <TouchableOpacity style={styles.backButton} onPress={() => { setShowPinEntry(false); setPin(''); setSelectedDelivery(null); }}>
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>🔑 Enter Delivery PIN</Text>
      <Text style={styles.subtitle}>Ask the customer for their 4-digit PIN</Text>

      <View style={styles.pinContainer}>
        <TextInput
          style={styles.pinInput}
          placeholder="• • • •"
          placeholderTextColor="#ADB5BD"
          keyboardType="numeric"
          maxLength={4}
          value={pin}
          onChangeText={setPin}
          autoFocus
        />
      </View>

      <TouchableOpacity style={styles.saveButton} onPress={verifyPinAndDeliver}>
        <Text style={styles.saveButtonText}>✅ Verify & Deliver</Text>
      </TouchableOpacity>

      <Text style={styles.pinHelp}>
        💡 The customer received this PIN via SMS when you were assigned this order.
      </Text>
    </>
  );

  // ============================================================
  // RENDER DASHBOARD
  // ============================================================
  const renderDashboard = () => (
    <>
      <Text style={styles.title}>🏍️ Rider Dashboard</Text>
      <Text style={styles.subtitle}>Manage your deliveries.</Text>

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={[styles.statCard, styles.pendingCard]}>
          <Text style={styles.statNumber}>{stats.pending}</Text>
          <Text style={styles.statLabel}>In Progress</Text>
        </View>
        <View style={[styles.statCard, styles.completedCard]}>
          <Text style={styles.statNumber}>{stats.completed}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📦 Today's Deliveries</Text>
        {loading ? (
          <ActivityIndicator size="large" color="#01311F" style={styles.loader} />
        ) : deliveries.length === 0 ? (
          <Text style={styles.emptyText}>No deliveries assigned.</Text>
        ) : (
          deliveries.slice(0, 5).map((delivery, index) => {
            const deliveryAddress = delivery.shopId?.address;
            const pickupAddress = delivery.distributorId?.address;
            return (
              <View key={index} style={styles.deliveryItem}>
                <TouchableOpacity
                  style={{ flex: 1 }}
                  onPress={() => handleDeliveryPress(delivery)}
                >
                  <Text style={styles.deliveryId}>#{delivery._id.slice(-6).toUpperCase()}</Text>
                  <Text style={styles.deliveryAddress}>📍 {deliveryAddress?.city || 'Unknown'} ← {pickupAddress?.city || 'Unknown'}</Text>
                  {delivery.status === 'confirmed' && (
                    <Text style={styles.actionHint}>Tap to pick up →</Text>
                  )}
                  {(delivery.status === 'picked_up' || delivery.status === 'out_for_delivery') && (
                    <Text style={styles.actionHint}>Tap to enter PIN →</Text>
                  )}
                  {delivery.status === 'cancelled' && (
                    <Text style={styles.cancelledHint}>❌ Cancelled by {delivery.cancelledBy}</Text>
                  )}
                </TouchableOpacity>
                <View style={styles.deliveryRight}>
                  <TouchableOpacity style={styles.chatButton} onPress={() => openChat(delivery)}>
                    <Text style={styles.chatButtonText}>💬</Text>
                  </TouchableOpacity>
                  <Text style={styles.deliveryStatus}>{delivery.status?.toUpperCase()}</Text>
                  <Text style={styles.deliveryTotal}>₦{delivery.total?.toLocaleString()}</Text>
                </View>
              </View>
            );
          })
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
      <Text style={styles.subtitle}>Manage your rider preferences.</Text>

      <View style={styles.settingsCard}>
        <Text style={styles.settingsCardTitle}>👤 Profile</Text>
        <Text style={styles.formLabel}>Full Name</Text>
        <TextInput style={styles.formInput} value={profile.fullName}
          onChangeText={(text) => setProfile({ ...profile, fullName: text })}
          placeholder="Full name" placeholderTextColor="#ADB5BD" />
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

      <View style={styles.settingsCard}>
        <Text style={styles.settingsCardTitle}>🏍️ Vehicle</Text>
        <Text style={styles.formLabel}>Vehicle Type</Text>
        <View style={styles.chipRow}>
          {['motorcycle', 'tricycle', 'bicycle', 'car', 'van'].map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.chip, profile.vehicleType === type && styles.chipActive]}
              onPress={() => setProfile({ ...profile, vehicleType: type })}
            >
              <Text style={[styles.chipText, profile.vehicleType === type && styles.chipTextActive]}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.formLabel}>Vehicle Plate</Text>
        <TextInput style={styles.formInput} value={profile.vehiclePlate}
          onChangeText={(text) => setProfile({ ...profile, vehiclePlate: text })}
          placeholder="e.g., LAG-123-AB" placeholderTextColor="#ADB5BD" />
        <TouchableOpacity style={styles.saveButton} onPress={saveVehicle} disabled={savingVehicle}>
          {savingVehicle ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveButtonText}>💾 Save Vehicle</Text>}
        </TouchableOpacity>
      </View>

      <View style={styles.settingsCard}>
        <Text style={styles.settingsCardTitle}>📍 Service Area</Text>
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
        <Text style={styles.formLabel}>Service Radius (km)</Text>
        <TextInput style={styles.formInput} value={profile.radius}
          onChangeText={(text) => setProfile({ ...profile, radius: text })}
          placeholder="10" placeholderTextColor="#ADB5BD" keyboardType="numeric" />
        <TouchableOpacity style={styles.saveButton} onPress={saveServiceArea} disabled={savingService}>
          {savingService ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveButtonText}>💾 Save Service Area</Text>}
        </TouchableOpacity>
      </View>

      <View style={styles.settingsCard}>
        <Text style={styles.settingsCardTitle}>💰 Bank Details</Text>
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
          {savingBank ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveButtonText}>💾 Save Bank Details</Text>}
        </TouchableOpacity>
      </View>

      <View style={styles.settingsCard}>
        <Text style={styles.settingsCardTitle}>🔔 Notification Preferences</Text>

        <View style={styles.notifRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.notifLabel}>SMS Notifications</Text>
            <Text style={styles.notifHint}>Receive delivery updates via SMS</Text>
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
            <Text style={styles.notifHint}>Receive new delivery alerts in the app</Text>
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
        <Text style={styles.dangerSubtitle}>Once you deactivate, there is no going back.</Text>
        <TouchableOpacity style={styles.dangerButton} onPress={() => Alert.alert('Warning', 'Account deactivation coming soon!')}>
          <Text style={styles.dangerButtonText}>🗑️ Deactivate Account</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.welcome}>Hello, {user?.name || 'Rider'}! 👋</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={openNotifications} style={styles.bellButton}>
            <Text style={styles.bellIcon}>🔔</Text>
            {unreadCount > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Text style={styles.logoutText}>🚪</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {showPinEntry
          ? renderPinEntry()
          : activeTab === 'dashboard'
            ? renderDashboard()
            : renderSettings()
        }
      </ScrollView>

      {!showPinEntry && (
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
      {/* Notifications Modal */}
      {showNotificationsModal && (
        <Modal visible={showNotificationsModal} animationType="slide" transparent={false}>
          <SafeAreaView style={styles.chatContainer}>
            <View style={styles.chatHeader}>
              <TouchableOpacity onPress={() => setShowNotificationsModal(false)}>
                <Text style={styles.chatBack}>← Back</Text>
              </TouchableOpacity>
              <View style={styles.chatHeaderInfo}>
                <Text style={styles.chatHeaderName}>🔔 Notifications</Text>
                <Text style={styles.chatHeaderRole}>
                  {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
                </Text>
              </View>
              {unreadCount > 0 ? (
                <TouchableOpacity onPress={markAllNotificationsRead}>
                  <Text style={styles.markAllRead}>Mark all read</Text>
                </TouchableOpacity>
              ) : (
                <View style={{ width: 60 }} />
              )}
            </View>

            <ScrollView contentContainerStyle={{ padding: 16 }}>
              {loadingNotifs ? (
                <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
              ) : notifications.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 60 }}>
                  <Text style={{ fontSize: 48, marginBottom: 12 }}>🔔</Text>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.primary }}>
                    No notifications yet
                  </Text>
                </View>
              ) : (
                notifications.map((notif, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.notifRow, !notif.read && styles.notifRowUnread]}
                    onPress={() => handleNotificationPress(notif)}
                  >
                    <View style={styles.notifIconWrap}>
                      <Text style={styles.notifIcon}>
                        {notif.type === 'order_placed' ? '📦' :
                         notif.type === 'new_order' ? '🆕' :
                         notif.type === 'order_confirmed' ? '✅' :
                         notif.type === 'rider_assigned' ? '🏍️' :
                         notif.type === 'delivery_assigned' ? '🚚' :
                         notif.type === 'order_delivered' ? '✅' :
                         notif.type === 'order_cancelled' ? '❌' :
                         notif.type === 'chat_message' ? '💬' :
                         notif.type === 'product_request' ? '📝' : '🔔'}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.notifTitle, !notif.read && { fontWeight: '800' }]}>
                        {notif.title}
                      </Text>
                      {notif.body ? (
                        <Text style={styles.notifBody} numberOfLines={2}>{notif.body}</Text>
                      ) : null}
                      <Text style={styles.notifTime}>{timeAgo(notif.createdAt)}</Text>
                    </View>
                    {!notif.read && <View style={styles.unreadDot} />}
                  </TouchableOpacity>
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
  completed: '#1B5E20',
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
  statCard: { flex: 1, minWidth: '30%', backgroundColor: COLORS.white, padding: 16, borderRadius: 12, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  pendingCard: { borderLeftWidth: 4, borderLeftColor: COLORS.pending },
  completedCard: { borderLeftWidth: 4, borderLeftColor: COLORS.completed },
  statNumber: { fontSize: 24, fontWeight: '700', color: COLORS.primary },
  statLabel: { fontSize: 12, color: COLORS.gray, marginTop: 4 },
  section: { backgroundColor: COLORS.white, padding: 16, borderRadius: 12, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12, color: COLORS.primary },
  loader: { marginVertical: 20 },
  deliveryItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  deliveryId: { fontSize: 14, fontWeight: '600', color: COLORS.primary },
  deliveryAddress: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  actionHint: { fontSize: 11, color: COLORS.secondary, fontWeight: '600', marginTop: 4 },
  deliveryRight: { alignItems: 'flex-end', gap: 4 },
  deliveryStatus: { fontSize: 11, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, backgroundColor: COLORS.lightGray },
  deliveryTotal: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  chatButton: { backgroundColor: '#6C5CE7', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  chatButtonText: { color: '#FFFFFF', fontSize: 14 },
  emptyText: { color: COLORS.gray, textAlign: 'center', padding: 20 },
  // Settings
  settingsCard: { backgroundColor: COLORS.white, padding: 20, borderRadius: 12, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  settingsCardTitle: { fontSize: 18, fontWeight: '700', color: COLORS.primary, marginBottom: 16 },
  formLabel: { fontSize: 13, fontWeight: '600', color: COLORS.primary, marginBottom: 6, marginTop: 8 },
  formInput: { backgroundColor: COLORS.background, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: COLORS.lightGray, fontSize: 15, color: COLORS.primary },
  formRow: { flexDirection: 'row', gap: 12 },
  formHalf: { flex: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.lightGray },
  chipActive: { backgroundColor: COLORS.primary },
  chipText: { fontSize: 13, color: COLORS.gray, fontWeight: '600' },
  chipTextActive: { color: COLORS.white },
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
  // PIN entry
  backButton: { paddingVertical: 8, marginBottom: 8 },
  backButtonText: { color: COLORS.primary, fontSize: 16, fontWeight: '600' },
  pinContainer: { backgroundColor: COLORS.white, borderRadius: 12, borderWidth: 2, borderColor: COLORS.primary, marginBottom: 24 },
  pinInput: { padding: 24, fontSize: 32, textAlign: 'center', letterSpacing: 16, color: COLORS.primary, fontWeight: '700' },
  pinHelp: { textAlign: 'center', color: COLORS.gray, fontSize: 13, marginTop: 24, paddingHorizontal: 20 },
  // Tab bar
  tabBar: { flexDirection: 'row', backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.lightGray, paddingVertical: 8, paddingBottom: 20 },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  tabItemActive: { borderTopWidth: 3, borderTopColor: COLORS.primary, marginTop: -11 },
  tabIcon: { fontSize: 24 },
  tabLabel: { fontSize: 12, color: COLORS.gray, marginTop: 4 },
  tabLabelActive: { color: COLORS.primary, fontWeight: '600' },
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
  cancelledHint: { fontSize: 11, color: COLORS.danger, fontWeight: '600', marginTop: 4, },
  // Notification preferences
  notifRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  notifLabel: { fontSize: 15, fontWeight: '600', color: COLORS.primary },
  notifHint: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bellButton: { padding: 8, position: 'relative' },
  bellIcon: { fontSize: 22 },
  bellBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#E17055',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
    markAllRead: {
    fontSize: 12,
    color: COLORS.secondary,
    fontWeight: '700',
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
  notifRowUnread: {
    backgroundColor: '#F0F9EC',
    borderLeftWidth: 3,
    borderLeftColor: COLORS.secondary,
  },
  notifIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifIcon: { fontSize: 18 },
  notifTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 2,
  },
  notifBody: {
    fontSize: 13,
    color: COLORS.gray,
    lineHeight: 18,
  },
  notifTime: {
    fontSize: 11,
    color: COLORS.gray,
    marginTop: 4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.secondary,
    marginTop: 6,
  },
});