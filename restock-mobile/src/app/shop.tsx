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
  Switch,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Rating } from '@kolking/react-native-rating';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';

const API_URL = 'https://restock-backend-zkrx.onrender.com/api';

export default function ShopScreen() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [orderFilter, setOrderFilter] = useState('all');
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

  // Notifications
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [loadingNotifs, setLoadingNotifs] = useState(false);

  // Dashboard data
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, delivered: 0, spent: 0 });

  // Shop (browse) state
  const [shopSearch, setShopSearch] = useState('');
  const [shopResults, setShopResults] = useState([]);
  const [shopSearched, setShopSearched] = useState(false);
  const [cart, setCart] = useState([]);
  const [showCartModal, setShowCartModal] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmOrderNumbers, setConfirmOrderNumbers] = useState([]);

  // Request product modal
  const [showRequestModal, setShowRequestModal] = useState(false);
  // AI image ordering
  const [aiResults, setAiResults] = useState([]);
  const [aiRawText, setAiRawText] = useState('');
  const [showAiModal, setShowAiModal] = useState(false);
  const [uploadingAi, setUploadingAi] = useState(false);
  const [requestForm, setRequestForm] = useState({
    productName: '',
    category: 'Beverages',
    quantity: '1',
    unit: 'carton',
    notes: '',
  });
  const [submittingRequest, setSubmittingRequest] = useState(false);

  // Settings data
  const [profile, setProfile] = useState({
    businessName: '', ownerName: '', phone: '', email: '',
    street: '', city: '', state: '', landmark: '',
  });
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Notification preferences
  const [notifPrefs, setNotifPrefs] = useState({ sms: true, push: true });
  const [savingNotifPrefs, setSavingNotifPrefs] = useState(false);

  useEffect(() => {
    loadUser();
    loadProducts();
    loadOrders();
    loadUnreadCount();

    // Poll unread count every 30 seconds
    const interval = setInterval(loadUnreadCount, 30000);
    return () => clearInterval(interval);
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
  // SEARCH PRODUCTS (in Shop tab)
  // ============================================================
  const runShopSearch = (term) => {
    const q = (term ?? shopSearch).trim().toLowerCase();
    setShopSearch(term ?? shopSearch);

    if (!q) {
      setShopResults([]);
      setShopSearched(false);
      return;
    }

    const results = products.filter(p =>
      p.name?.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q)
    );
    setShopResults(results);
    setShopSearched(true);
  };

  const quickShopSearch = (term) => {
    setShopSearch(term);
    runShopSearch(term);
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
          setNotifPrefs({
            sms: shop.notificationPrefs?.sms !== false,
            push: shop.notificationPrefs?.push !== false,
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
    loadUnreadCount();
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'settings') loadSettingsData();
  };

  // ============================================================
  // HELPERS — greeting + trends
  // ============================================================
  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const isToday = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  };

  const isThisWeek = (dateStr) => {
    const d = new Date(dateStr);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return d >= weekAgo;
  };

  const getTrends = () => {
    const todayCount = orders.filter(o => isToday(o.createdAt)).length;
    const weekDelivered = orders.filter(o =>
      o.status === 'delivered' && isThisWeek(o.createdAt)
    ).length;
    const inTransit = orders.filter(o =>
      o.status === 'picked_up' || o.status === 'out_for_delivery' || o.status === 'confirmed'
    ).length;

    return { todayCount, weekDelivered, inTransit };
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

    // Deep-link based on type
    const data = notif.data || {};
    if (data.orderId) {
      if (notif.type === 'chat_message') {
        // Open the chat for that order — requires an order object
        // For now, just go to the Orders tab
        setActiveTab('orders');
      } else {
        setActiveTab('orders');
      }
    } else if (notif.type === 'product_request') {
      // Admin — no action on mobile
    }
  };

  const timeAgo = (dateStr) => {
    const now = new Date();
    const past = new Date(dateStr);
    const seconds = Math.floor((now - past) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return past.toLocaleDateString();
  };

  // ============================================================
  // RECOMMENDATIONS — past purchases, fallback to random products
  // ============================================================
  const getRecommended = () => {
    // Collect unique product names from past orders
    const boughtNames = new Set();
    orders.forEach(o => {
      (o.items || []).forEach(it => {
        if (it.productName) boughtNames.add(it.productName.toLowerCase());
      });
    });

    // Match against catalogue
    const matches = products.filter(p =>
      boughtNames.has(p.name?.toLowerCase())
    );

    // Take up to 3, dedupe by name
    const seen = new Set();
    const uniqueMatches = [];
    for (const p of matches) {
      const key = p.name?.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        uniqueMatches.push(p);
        if (uniqueMatches.length === 3) break;
      }
    }

    if (uniqueMatches.length > 0) return uniqueMatches;

    // Fallback: random 3 from catalogue (dedupe by name)
    const shuffled = [...products].sort(() => Math.random() - 0.5);
    const seenFallback = new Set();
    const picks = [];
    for (const p of shuffled) {
      const key = p.name?.toLowerCase();
      if (!seenFallback.has(key)) {
        seenFallback.add(key);
        picks.push(p);
        if (picks.length === 3) break;
      }
    }
    return picks;
  };

  // ============================================================
  // CART HELPERS
  // ============================================================
  const getCartItem = (productId, distributorId) =>
    cart.find(i => i.productId === productId && i.distributorId === distributorId);

  const getCartCount = () =>
    cart.reduce((sum, i) => sum + i.quantity, 0);

  const getCartTotal = () =>
    cart.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const getDeliveryFeeEstimate = () => {
    // Same logic as backend so the preview matches what gets charged.
    const unitWeights = {
      carton: 1.0, pack: 0.5, kg: 0.25, litre: 0.25, piece: 0.05,
    };
    const defaultWeight = 0.25;

    const cartons = Math.floor(
      cart.reduce((sum, i) => {
        const w = unitWeights[(i.unit || '').toLowerCase()] ?? defaultWeight;
        return sum + i.quantity * w;
      }, 0)
    );

    const volumeTiers = [
      { max: 3, fee: 0 },
      { max: 6, fee: 200 },
      { max: 10, fee: 400 },
      { max: 15, fee: 600 },
      { max: 20, fee: 900 },
    ];
    let surcharge = 900 + Math.max(0, cartons - 20) * 50;
    for (const t of volumeTiers) {
      if (cartons <= t.max) { surcharge = t.fee; break; }
    }

    // No coords on the client yet → use fallback base fee
    const baseFee = 800;

    return { baseFee, surcharge, total: baseFee + surcharge, cartons };
  };

  const addToCart = (product) => {
    const existing = getCartItem(product._id, product.distributorId);
    const stock = product.stock || 0;

    if (existing) {
      if (existing.quantity >= stock) {
        Alert.alert('⚠️ Not enough stock', `Only ${stock} available.`);
        return;
      }
      setCart(cart.map(i =>
        i.productId === product._id && i.distributorId === product.distributorId
          ? { ...i, quantity: i.quantity + 1 }
          : i
      ));
    } else {
      setCart([...cart, {
        productId: product._id,
        distributorId: product.distributorId,
        distributorName: product.distributorName,
        name: product.name,
        size: product.size || '',
        unit: product.unit || '',
        price: product.price || 0,
        quantity: 1,
        stock: stock,
      }]);
    }
  };



  const updateCartQty = (productId, distributorId, delta) => {
    setCart(prev => {
      const next = prev.map(i => {
        if (i.productId === productId && i.distributorId === distributorId) {
          const newQty = i.quantity + delta;
          if (newQty <= 0) return { ...i, quantity: 0 };
          if (newQty > i.stock) {
            Alert.alert('⚠️ Not enough stock', `Only ${i.stock} available.`);
            return i;
          }
          return { ...i, quantity: newQty };
        }
        return i;
      });
      return next.filter(i => i.quantity > 0);
    });
  };

  const removeFromCart = (productId, distributorId) => {
    setCart(prev => prev.filter(
      i => !(i.productId === productId && i.distributorId === distributorId)
    ));
  };

  const clearCart = () => setCart([]);

  // ============================================================
  // PLACE ORDER (splits cart by distributor, one POST each)
  // ============================================================
  const placeOrder = async () => {
    if (cart.length === 0) {
      Alert.alert('⚠️ Cart empty', 'Add items before placing an order.');
      return;
    }

    const shopId = user?.id;
    if (!shopId) {
      Alert.alert('❌ Error', 'Shop not found. Please log in again.');
      return;
    }

    setPlacingOrder(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const currentUser = user;

      // Group cart items by distributor
      const byDistributor = {};
      cart.forEach(item => {
        if (!byDistributor[item.distributorId]) {
          byDistributor[item.distributorId] = [];
        }
        byDistributor[item.distributorId].push(item);
      });

      const orderNumbers = [];

      for (const [distributorId, items] of Object.entries(byDistributor)) {
        const orderItems = items.map(item => ({
          productName: item.name,
          quantity: item.quantity,
          price: item.price,
          total: item.price * item.quantity,
        }));

        const subtotal = orderItems.reduce((sum, i) => sum + i.total, 0);

        const orderData = {
          shopId: shopId,
          distributorId: distributorId,
          items: orderItems,
          subtotal: subtotal,
          deliveryFee: 0,
          total: subtotal,
          paymentMethod: 'cash_on_delivery',
          deliveryAddress: {
            shopName: currentUser?.name || '',
            address: currentUser?.address?.street || '',
            city: currentUser?.address?.city || '',
            state: currentUser?.address?.state || '',
            landmark: currentUser?.address?.landmark || '',
          },
        };

        console.log('📦 Sending order:', JSON.stringify(orderData, null, 2));

        const response = await fetch(`${API_URL}/orders`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(orderData),
        });

        const data = await response.json();
        console.log('📦 Response:', data);

        if (data.success) {
          orderNumbers.push(data.order._id.slice(-6).toUpperCase());
        } else {
          Alert.alert('❌ Order failed', data.error || 'Unknown error');
          setPlacingOrder(false);
          return;
        }
      }

      // Success — clear cart, close modal, show confirmation
      setCart([]);
      setShowCartModal(false);
      setConfirmOrderNumbers(orderNumbers);
      setShowConfirmModal(true);
      loadOrders(); // refresh Orders tab

    } catch (error) {
      console.error('❌ Place order error:', error);
      Alert.alert('❌ Error', 'Could not place order. Check your connection.');
    } finally {
      setPlacingOrder(false);
    }
  };

  // ============================================================
  // SUBMIT PRODUCT REQUEST
  // ============================================================
  const submitProductRequest = async () => {
    if (!requestForm.productName.trim()) {
      Alert.alert('⚠️ Missing name', 'Please enter the product name.');
      return;
    }

    setSubmittingRequest(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_URL}/product-requests`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productName: requestForm.productName.trim(),
          category: requestForm.category,
          quantity: parseInt(requestForm.quantity) || 1,
          unit: requestForm.unit,
          notes: requestForm.notes.trim(),
        }),
      });

      const data = await response.json();
      if (data.success) {
        Alert.alert(
          '✅ Request submitted',
          "We'll notify you when a distributor stocks this product."
        );
        setShowRequestModal(false);
        setRequestForm({
          productName: '', category: 'Beverages',
          quantity: '1', unit: 'carton', notes: '',
        });
      } else {
        Alert.alert('❌ Error', data.error || 'Failed to submit request');
      }
    } catch (error) {
      console.error('Request error:', error);
      Alert.alert('❌ Error', 'Could not submit request');
    } finally {
      setSubmittingRequest(false);
    }
  };

    // ============================================================
  // AI IMAGE ORDERING
  // ============================================================
  const pickAndUploadImage = async () => {
    // 1. Ask for permission
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to upload a shopping list.');
      return;
    }

    // 2. Pick image (compressed)
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.7, // compress to save bandwidth
    });

    if (result.canceled || !result.assets || !result.assets[0]) return;

    const asset = result.assets[0];
    await uploadShoppingList(asset);
  };

  const takePhotoAndUpload = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow camera access to photograph a shopping list.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.7,
    });

    if (result.canceled || !result.assets || !result.assets[0]) return;

    const asset = result.assets[0];
    await uploadShoppingList(asset);
  };

  const uploadShoppingList = async (asset) => {
    setUploadingAi(true);
    try {
      const token = await AsyncStorage.getItem('token');

      // Build FormData with guaranteed non-null values
      const uri = asset.uri;
      const type = asset.mimeType || 'image/jpeg';
      const fileName = asset.fileName || `shopping-list-${Date.now()}.jpg`;

      console.log('📎 FormData parts:', { uri, type, fileName });

      const formData = new FormData();
      formData.append('image', {
        uri: uri,
        type: type,
        name: fileName,
      });

      console.log('📤 Uploading image:', asset.uri);

      const response = await axios.post(
        `${API_URL}/orders/ai-image`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            // axios sets Content-Type + boundary automatically
          },
        }
      );

      const data = response.data;
      console.log('🤖 AI response:', data);

      if (data.success && data.products && data.products.length > 0) {
        // Match each detected product against the catalogue
        const matched = data.products.map(p => {
          const found = products.find(cp =>
            cp.name?.toLowerCase().includes(p.name.toLowerCase()) ||
            p.name.toLowerCase().includes(cp.name?.toLowerCase() || '')
          );
          return {
            detectedName: p.name,
            detectedQty: p.quantity || 1,
            matched: found || null, // full product if found
            selected: true, // default: include
            quantity: p.quantity || 1,
          };
        });

        setAiResults(matched);
        setAiRawText(data.rawText || '');
        setShowAiModal(true);
      } else {
        Alert.alert(
          '🔍 Nothing detected',
          data.error || 'We couldn\'t read any products from that image. Try a clearer photo.'
        );
      }
    } catch (error) {
      console.error('❌ AI upload error:', error);
      Alert.alert('❌ Error', 'Could not process image. Check your connection.');
    } finally {
      setUploadingAi(false);
    }
  };

  const showUploadOptions = () => {
    Alert.alert(
      '📷 Upload Shopping List',
      'How would you like to add your list?',
      [
        { text: 'Take Photo', onPress: takePhotoAndUpload },
        { text: 'Choose from Gallery', onPress: pickAndUploadImage },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const addAiResultsToCart = () => {
    const toAdd = aiResults.filter(r => r.selected && r.matched);
    if (toAdd.length === 0) {
      Alert.alert('⚠️ Nothing to add', 'Select at least one matched product.');
      return;
    }

    // Add each to cart with the requested quantity
    let updatedCart = [...cart];

    toAdd.forEach(r => {
      const p = r.matched;
      const existingIdx = updatedCart.findIndex(i =>
        i.productId === p._id && i.distributorId === p.distributorId
      );

      if (existingIdx >= 0) {
        updatedCart[existingIdx] = {
          ...updatedCart[existingIdx],
          quantity: updatedCart[existingIdx].quantity + r.quantity,
        };
      } else {
        updatedCart.push({
          productId: p._id,
          distributorId: p.distributorId,
          distributorName: p.distributorName,
          name: p.name,
          size: p.size || '',
          unit: p.unit || '',
          price: p.price || 0,
          quantity: r.quantity,
          stock: p.stock || 0,
        });
      }
    });

    setCart(updatedCart);
    setShowAiModal(false);
    setAiResults([]);
    Alert.alert('✅ Added to Cart', `${toAdd.length} product${toAdd.length > 1 ? 's' : ''} added.`);
  };

  const toggleAiSelection = (index) => {
    setAiResults(prev => prev.map((r, i) => i === index ? { ...r, selected: !r.selected } : r));
  };

  const updateAiQty = (index, delta) => {
    setAiResults(prev => prev.map((r, i) =>
      i === index ? { ...r, quantity: Math.max(1, r.quantity + delta) } : r
    ));
  };

  const openRequestModal = () => {
    setRequestForm({ ...requestForm, productName: shopSearch });
    setShowRequestModal(true);
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
  // SAVE NOTIFICATION PREFERENCES
  // ============================================================
  const saveNotifPrefs = async () => {
    setSavingNotifPrefs(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const userData = await AsyncStorage.getItem('user');
      const currentUser = JSON.parse(userData);
      const response = await fetch(`${API_URL}/shops/${currentUser.id}/notification-prefs`, {
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
  // CANCEL ORDER (Shop) — Android + iOS safe
  // ============================================================
  const cancelOrder = (order) => {
    Alert.alert(
      '❌ Cancel Order',
      `Cancel order #${order._id.slice(-6).toUpperCase()}?\n\nTotal: ₦${order.total?.toLocaleString()}`,
      [
        { text: 'Never mind', style: 'cancel' },
        {
          text: 'Cancel Order',
          style: 'destructive',
          onPress: () => doCancelOrder(order._id, 'Cancelled by shop')
        }
      ]
    );
  };

  const doCancelOrder = async (orderId, reason) => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_URL}/orders/${orderId}/cancel`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason })
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
  };

  // ============================================================
  // OPEN CHAT (Shop version - chats with distributor or rider)
  // ============================================================
  const openChat = async (order) => {
    setChatOrderId(order._id);
    setShowChat(true);

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
  const renderDashboard = () => {
    const trends = getTrends();
    const recommended = getRecommended();
    const recentOrders = orders.slice(0, 3);

    return (
      <>
        {/* Hero banner */}
        <View style={styles.hero}>
          <TouchableOpacity
            style={styles.heroBell}
            onPress={openNotifications}
          >
            <Text style={styles.heroBellIcon}>🔔</Text>
            {unreadCount > 0 && (
              <View style={styles.heroBellBadge}>
                <Text style={styles.heroBellBadgeText}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <Text style={styles.heroGreeting}>{getGreeting()},</Text>
          <Text style={styles.heroShop}>{user?.name || 'Shop Owner'} 🏪</Text>
          <Text style={styles.heroTagline}>Ready to restock today?</Text>
          <TouchableOpacity
            style={styles.heroButton}
            onPress={() => setActiveTab('shop')}
          >
            <Text style={styles.heroButtonText}>🛒 Shop Now</Text>
            <Text style={styles.heroButtonArrow}>→</Text>
          </TouchableOpacity>
          <Text style={styles.heroEmoji}>📦</Text>
        </View>

        {/* Stat pills */}
        <View style={styles.statsGrid}>
          <View style={styles.statCardNew}>
            <View style={[styles.statIconCircle, { backgroundColor: '#E3F2FD' }]}>
              <Text style={styles.statIconText}>📦</Text>
            </View>
            <Text style={styles.statNumberNew}>{stats.total}</Text>
            <Text style={styles.statLabelNew}>Total Orders</Text>
            <Text style={styles.statTrend}>
              {trends.todayCount > 0 ? `+${trends.todayCount} today` : 'No orders today'}
            </Text>
          </View>

          <View style={styles.statCardNew}>
            <View style={[styles.statIconCircle, { backgroundColor: '#FFF3E0' }]}>
              <Text style={styles.statIconText}>⏳</Text>
            </View>
            <Text style={styles.statNumberNew}>{stats.pending}</Text>
            <Text style={styles.statLabelNew}>Pending</Text>
            <Text style={styles.statTrend}>
              {trends.inTransit > 0 ? `${trends.inTransit} in transit` : 'Nothing pending'}
            </Text>
          </View>

          <View style={styles.statCardNew}>
            <View style={[styles.statIconCircle, { backgroundColor: '#E8F5E9' }]}>
              <Text style={styles.statIconText}>✅</Text>
            </View>
            <Text style={styles.statNumberNew}>{stats.delivered}</Text>
            <Text style={styles.statLabelNew}>Delivered</Text>
            <Text style={styles.statTrend}>
              {trends.weekDelivered > 0 ? `${trends.weekDelivered} this week` : 'None this week'}
            </Text>
          </View>

          <View style={styles.statCardNew}>
            <View style={[styles.statIconCircle, { backgroundColor: '#E8EAF6' }]}>
              <Text style={styles.statIconText}>💰</Text>
            </View>
            <Text style={styles.statNumberNew}>₦{stats.spent.toLocaleString()}</Text>
            <Text style={styles.statLabelNew}>Total Spent</Text>
            <Text style={styles.statTrend}>All time</Text>
          </View>
        </View>

        {/* Quick actions */}
        <Text style={styles.sectionHeading}>Quick actions</Text>
        <View style={styles.actionGrid}>
          <TouchableOpacity style={styles.actionCard} onPress={() => setActiveTab('shop')}>
            <View style={[styles.actionIcon, { backgroundColor: '#E3F2FD' }]}>
              <Text style={styles.actionIconText}>🛒</Text>
            </View>
            <Text style={styles.actionTitle}>Shop Now</Text>
            <Text style={styles.actionSubtitle}>Browse products</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={() => setActiveTab('orders')}>
            <View style={[styles.actionIcon, { backgroundColor: '#FFF3E0' }]}>
              <Text style={styles.actionIconText}>📦</Text>
            </View>
            <Text style={styles.actionTitle}>My Orders</Text>
            <Text style={styles.actionSubtitle}>Track deliveries</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={() => setActiveTab('shop')}>
            <View style={[styles.actionIcon, { backgroundColor: '#F3E5F5' }]}>
              <Text style={styles.actionIconText}>🔍</Text>
            </View>
            <Text style={styles.actionTitle}>Search</Text>
            <Text style={styles.actionSubtitle}>Find products</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={() => setActiveTab('settings')}>
            <View style={[styles.actionIcon, { backgroundColor: '#E8F5E9' }]}>
              <Text style={styles.actionIconText}>⚙️</Text>
            </View>
            <Text style={styles.actionTitle}>Settings</Text>
            <Text style={styles.actionSubtitle}>Manage account</Text>
          </TouchableOpacity>
        </View>

        {/* Recent orders */}
        {recentOrders.length > 0 && (
          <>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeading}>Recent orders</Text>
              <TouchableOpacity onPress={() => setActiveTab('orders')}>
                <Text style={styles.seeAllText}>See all →</Text>
              </TouchableOpacity>
            </View>
            {recentOrders.map((order, idx) => {
              const statusColor =
                order.status === 'delivered' ? '#1B5E20' :
                order.status === 'pending' ? '#E65100' :
                order.status === 'cancelled' ? '#C62828' : '#0D47A1';
              const statusBg =
                order.status === 'delivered' ? '#E8F5E9' :
                order.status === 'pending' ? '#FFF3E0' :
                order.status === 'cancelled' ? '#FFEBEE' : '#E3F2FD';
              return (
                <TouchableOpacity
                  key={idx}
                  style={styles.recentOrderRow}
                  onPress={() => setActiveTab('orders')}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recentOrderId}>
                      #{order._id.slice(-6).toUpperCase()}
                    </Text>
                    <View style={[styles.statusPill, { backgroundColor: statusBg }]}>
                      <Text style={[styles.statusPillText, { color: statusColor }]}>
                        {order.status?.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.recentOrderTotal}>
                    ₦{order.total?.toLocaleString()}
                  </Text>
                  <Text style={styles.recentOrderArrow}>→</Text>
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {/* Recommended */}
        {recommended.length > 0 && (
          <>
            <Text style={styles.sectionHeading}>
              {orders.length > 0 ? 'Buy again' : 'Popular right now'}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 12, paddingBottom: 8 }}
            >
              {recommended.map((product, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.recCard}
                  onPress={() => {
                    setActiveTab('shop');
                    setTimeout(() => quickShopSearch(product.name), 100);
                  }}
                >
                  <View style={styles.recImagePlaceholder}>
                    <Text style={styles.recEmoji}>📦</Text>
                  </View>
                  <Text style={styles.recName} numberOfLines={2}>
                    {product.name}
                  </Text>
                  <Text style={styles.recPrice}>
                    ₦{product.price?.toLocaleString() || 0}
                  </Text>
                  <Text style={styles.recDist} numberOfLines={1}>
                    {product.distributorName}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}
      </>
    );
  };

  // ============================================================
  // RENDER ORDERS TAB
  // ============================================================
  const renderOrders = () => {
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

    const statusColor = (status) => {
      if (status === 'delivered') return '#1B5E20';
      if (status === 'pending') return '#E65100';
      if (status === 'cancelled') return '#C62828';
      if (status === 'confirmed') return '#0D47A1';
      if (status === 'picked_up' || status === 'out_for_delivery') return '#4A148C';
      return '#6C757D';
    };

    const statusBg = (status) => {
      if (status === 'delivered') return '#E8F5E9';
      if (status === 'pending') return '#FFF3E0';
      if (status === 'cancelled') return '#FFEBEE';
      if (status === 'confirmed') return '#E3F2FD';
      if (status === 'picked_up' || status === 'out_for_delivery') return '#F3E5F5';
      return '#F1F3F5';
    };

    return (
      <>
        <Text style={styles.title}>📦 My Orders</Text>
        <Text style={styles.subtitle}>Track your order history.</Text>

        {/* Filter chips */}
        <View style={styles.filterChipRow}>
          {[
            { key: 'all', label: 'All' },
            { key: 'pending', label: 'Pending' },
            { key: 'confirmed', label: 'Confirmed' },
            { key: 'picked_up', label: 'In Transit' },
            { key: 'delivered', label: 'Delivered' },
          ].map(f => (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterChip, orderFilter === f.key && styles.filterChipActive]}
              onPress={() => setOrderFilter(f.key)}
            >
              <Text style={[
                styles.filterChipText,
                orderFilter === f.key && styles.filterChipTextActive,
              ]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {visibleOrders.length === 0 ? (
          <Text style={styles.emptyText}>
            {orderFilter === 'all'
              ? 'No orders yet. Start shopping!'
              : `No ${orderFilter.replace('_', ' ')} orders.`}
          </Text>
        ) : (
          visibleOrders.map((order, index) => (
            <View key={index} style={styles.orderItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.orderId}>#{order._id.slice(-6).toUpperCase()}</Text>
                <Text style={styles.orderItemsText}>{itemsSummary(order)}</Text>
                <View style={styles.orderStatusRow}>
                  <View style={[styles.statusPill, { backgroundColor: statusBg(order.status) }]}>
                    <Text style={[styles.statusPillText, { color: statusColor(order.status) }]}>
                      {order.status?.toUpperCase().replace('_', ' ')}
                    </Text>
                  </View>
                  <Text style={styles.orderTotal}>₦{order.total?.toLocaleString()}</Text>
                </View>
              </View>
              <View style={styles.orderActions}>
                {order.status === 'pending' && (
                  <TouchableOpacity style={styles.cancelOrderButton} onPress={() => cancelOrder(order)}>
                    <Text style={styles.cancelOrderButtonText}>❌</Text>
                  </TouchableOpacity>
                )}
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
      </>
    );
  };

  // ============================================================
  // RENDER SHOP TAB (Browse + search + add to cart)
  // ============================================================
  const renderShop = () => {
    // Group results by distributor
    const grouped = {};
    shopResults.forEach(p => {
      const key = p.distributorId;
      if (!grouped[key]) {
        grouped[key] = {
          distributorId: key,
          distributorName: p.distributorName,
          products: [],
        };
      }
      grouped[key].products.push(p);
    });
    const groups = Object.values(grouped);

    return (
      <>
        <Text style={styles.title}>🛒 Shop Now</Text>
        <Text style={styles.subtitle}>Search products from distributors.</Text>

        {getCartCount() > 0 && (
          <TouchableOpacity
            style={styles.viewCartButton}
            onPress={() => setShowCartModal(true)}
          >
            <Text style={styles.viewCartButtonText}>
              🛒 View Cart ({getCartCount()} {getCartCount() === 1 ? 'item' : 'items'}) — ₦{getCartTotal().toLocaleString()}
            </Text>
          </TouchableOpacity>
        )}

        {/* Search input */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="🔍 Search (e.g., Indomie, Peak Milk)"
            placeholderTextColor="#ADB5BD"
            value={shopSearch}
            onChangeText={setShopSearch}
            onSubmitEditing={() => runShopSearch()}
            returnKeyType="search"
          />
        </View>

        {/* AI upload button */}
        <TouchableOpacity
          style={styles.aiUploadButton}
          onPress={showUploadOptions}
          disabled={uploadingAi}
        >
          {uploadingAi ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.aiUploadEmoji}>📷</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.aiUploadTitle}>Upload Shopping List</Text>
                <Text style={styles.aiUploadSubtitle}>
                  Snap a photo — AI will find the products
                </Text>
              </View>
            </>
          )}
        </TouchableOpacity>

        {/* Popular chips */}
        <View style={styles.chipRow}>
          {['Indomie', 'Peak Milk', 'Gino', 'Cadbury', 'Rice', 'Sugar'].map(tag => (
            <TouchableOpacity
              key={tag}
              style={styles.chip}
              onPress={() => quickShopSearch(tag)}
            >
              <Text style={styles.chipText}>{tag}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Results */}
        {!shopSearched ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🔍 Search for products</Text>
            <Text style={styles.emptyText}>
              {products.length > 0
                ? `${products.length} products available. Search or tap a tag above.`
                : 'Loading products...'}
            </Text>
          </View>
        ) : shopResults.length === 0 ? (
          <View style={styles.noResultsCard}>
            <Text style={styles.noResultsEmoji}>🔍</Text>
            <Text style={styles.noResultsTitle}>Product Not Available</Text>
            <Text style={styles.noResultsText}>
              We couldn't find "{shopSearch}" from any distributor.
            </Text>
            <Text style={styles.noResultsSubtext}>
              Would you like us to find it for you?
            </Text>
            <TouchableOpacity
              style={styles.requestButton}
              onPress={openRequestModal}
            >
              <Text style={styles.requestButtonText}>📝 Request This Product</Text>
            </TouchableOpacity>
          </View>
        ) : (
          groups.map(group => (
            <View key={group.distributorId} style={styles.section}>
              <Text style={styles.sectionTitle}>🏪 {group.distributorName}</Text>

              {group.products.map((product, idx) => {
                const sizeDisplay = product.size ? ` • ${product.size}` : '';
                const unitDisplay = product.unit ? ` / ${product.unit}` : '';
                return (
                  <View key={idx} style={styles.productRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.productName}>
                        {product.name}{sizeDisplay}{unitDisplay}
                      </Text>
                      <Text style={styles.productStock}>
                        {product.stock || 0} in stock
                      </Text>
                    </View>
                    <Text style={styles.productPrice}>
                      ₦{product.price?.toLocaleString() || 0}
                    </Text>
                    {(() => {
                      const cartItem = getCartItem(product._id, product.distributorId);
                      const qty = cartItem ? cartItem.quantity : 0;

                      if (qty > 0) {
                        return (
                          <View style={styles.qtyControl}>
                            <TouchableOpacity
                              style={styles.qtyBtn}
                              onPress={() => updateCartQty(product._id, product.distributorId, -1)}
                            >
                              <Text style={styles.qtyBtnText}>−</Text>
                            </TouchableOpacity>
                            <Text style={styles.qtyValue}>{qty}</Text>
                            <TouchableOpacity
                              style={styles.qtyBtn}
                              onPress={() => updateCartQty(product._id, product.distributorId, 1)}
                            >
                              <Text style={styles.qtyBtnText}>+</Text>
                            </TouchableOpacity>
                          </View>
                        );
                      }

                      return (
                        <TouchableOpacity
                          style={styles.addButton}
                          onPress={() => addToCart(product)}
                        >
                          <Text style={styles.addButtonText}>+ Add</Text>
                        </TouchableOpacity>
                      );
                    })()}
                  </View>
                );
              })}
            </View>
          ))
        )}
      </>
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
        <Text style={styles.settingsCardTitle}>🔔 Notification Preferences</Text>

        <View style={styles.notifRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.notifLabel}>SMS Notifications</Text>
            <Text style={styles.notifHint}>Receive order updates via SMS</Text>
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
            <Text style={styles.notifHint}>Receive order updates in the app</Text>
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

      <TouchableOpacity
        style={[styles.settingsCard, { flexDirection: 'row', alignItems: 'center' }]}
        onPress={handleLogout}
      >
        <Text style={{ fontSize: 24, marginRight: 16 }}>🚪</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.settingsCardTitle}>Log Out</Text>
          <Text style={{ fontSize: 13, color: COLORS.gray, marginTop: 2 }}>
            Sign out of your account
          </Text>
        </View>
        <Text style={{ fontSize: 20, color: COLORS.gray }}>→</Text>
      </TouchableOpacity>

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
      {/* Header removed — greeting lives in the hero card */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'shop' && renderShop()}
        {activeTab === 'orders' && renderOrders()}
        {activeTab === 'settings' && renderSettings()}
      </ScrollView>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'dashboard' && styles.tabItemActive]}
          onPress={() => handleTabChange('dashboard')}
        >
          <Text style={styles.tabIcon}>🏠</Text>
          <Text style={[styles.tabLabel, activeTab === 'dashboard' && styles.tabLabelActive]}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'shop' && styles.tabItemActive]}
          onPress={() => handleTabChange('shop')}
        >
          <View>
            <Text style={styles.tabIcon}>🛒</Text>
            {getCartCount() > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>
                  {getCartCount() > 99 ? '99+' : getCartCount()}
                </Text>
              </View>
            )}
          </View>
          <Text style={[styles.tabLabel, activeTab === 'shop' && styles.tabLabelActive]}>Shop</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'orders' && styles.tabItemActive]}
          onPress={() => handleTabChange('orders')}
        >
          <Text style={styles.tabIcon}>📦</Text>
          <Text style={[styles.tabLabel, activeTab === 'orders' && styles.tabLabelActive]}>Orders</Text>
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
      {/* Cart Modal */}
      {showCartModal && (
        <Modal visible={showCartModal} animationType="slide" transparent={false}>
          <SafeAreaView style={styles.chatContainer}>
            <View style={styles.chatHeader}>
              <TouchableOpacity onPress={() => setShowCartModal(false)}>
                <Text style={styles.chatBack}>← Back</Text>
              </TouchableOpacity>
              <View style={styles.chatHeaderInfo}>
                <Text style={styles.chatHeaderName}>🛒 Your Cart</Text>
                <Text style={styles.chatHeaderRole}>
                  {getCartCount()} {getCartCount() === 1 ? 'item' : 'items'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => {
                Alert.alert(
                  'Clear cart?',
                  'Remove all items from the cart?',
                  [
                    { text: 'No', style: 'cancel' },
                    { text: 'Clear', style: 'destructive', onPress: clearCart },
                  ]
                );
              }}>
                <Text style={styles.cartClearText}>Clear</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16 }}>
              {cart.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 60 }}>
                  <Text style={{ fontSize: 48, marginBottom: 12 }}>🛒</Text>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.primary }}>
                    Your cart is empty
                  </Text>
                  <Text style={{ color: COLORS.gray, marginTop: 6 }}>
                    Browse products to add items
                  </Text>
                </View>
              ) : (
                cart.map((item, idx) => (
                  <View key={idx} style={styles.cartItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cartItemName}>{item.name}</Text>
                      <Text style={styles.cartItemDist}>
                        from {item.distributorName}
                      </Text>
                      <Text style={styles.cartItemPrice}>
                        ₦{item.price.toLocaleString()} × {item.quantity}
                      </Text>
                    </View>
                    <View style={styles.cartItemActions}>
                      <TouchableOpacity
                        style={styles.qtyBtn}
                        onPress={() => updateCartQty(item.productId, item.distributorId, -1)}
                      >
                        <Text style={styles.qtyBtnText}>−</Text>
                      </TouchableOpacity>
                      <Text style={styles.qtyValue}>{item.quantity}</Text>
                      <TouchableOpacity
                        style={styles.qtyBtn}
                        onPress={() => updateCartQty(item.productId, item.distributorId, 1)}
                      >
                        <Text style={styles.qtyBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity
                      style={styles.cartItemRemove}
                      onPress={() => removeFromCart(item.productId, item.distributorId)}
                    >
                      <Text style={styles.cartItemRemoveText}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>

            {cart.length > 0 && (
              <View style={styles.cartFooter}>
                <View style={styles.cartTotalRow}>
                  <Text style={styles.cartTotalLabel}>Subtotal:</Text>
                  <Text style={styles.cartTotalValue}>
                    ₦{getCartTotal().toLocaleString()}
                  </Text>
                </View>

                <View style={styles.cartTotalRow}>
                  <Text style={styles.cartTotalLabel}>
                    🚚 Delivery ({getDeliveryFeeEstimate().cartons} cartons):
                  </Text>
                  <Text style={styles.cartTotalValue}>
                    ₦{getDeliveryFeeEstimate().total.toLocaleString()}
                  </Text>
                </View>

                <View style={[styles.cartTotalRow, { marginTop: 4 }]}>
                  <Text style={[styles.cartTotalLabel, { fontWeight: '700' }]}>Grand Total:</Text>
                  <Text style={[styles.cartTotalValue, { fontSize: 24 }]}>
                    ₦{(getCartTotal() + getDeliveryFeeEstimate().total).toLocaleString()}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.cartCheckoutButton, placingOrder && { opacity: 0.6 }]}
                  onPress={placeOrder}
                  disabled={placingOrder}
                >
                  {placingOrder ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.cartCheckoutText}>📦 Place Order</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </SafeAreaView>
        </Modal>
      )}
      {/* Order Confirmation Modal */}
      {showConfirmModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalCard}>
            <Text style={styles.confirmEmoji}>✅</Text>
            <Text style={styles.confirmTitle}>Order Placed!</Text>
            <Text style={styles.confirmSubtitle}>
              Your order has been sent to the distributor.
            </Text>

            <View style={styles.confirmNumbersBox}>
              <Text style={styles.confirmNumbersLabel}>
                {confirmOrderNumbers.length > 1 ? 'Order numbers:' : 'Order number:'}
              </Text>
              {confirmOrderNumbers.map((num, i) => (
                <Text key={i} style={styles.confirmNumbersText}>
                  #{num}
                </Text>
              ))}
            </View>

            <TouchableOpacity
              style={styles.confirmButton}
              onPress={() => {
                setShowConfirmModal(false);
                setActiveTab('orders');
              }}
            >
              <Text style={styles.confirmButtonText}>View My Orders</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.confirmSecondaryButton}
              onPress={() => {
                setShowConfirmModal(false);
                setActiveTab('shop');
              }}
            >
              <Text style={styles.confirmSecondaryText}>Keep Shopping</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      {/* Request Product Modal */}
      {showRequestModal && (
        <Modal visible={showRequestModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.requestModalCard}>
              <View style={styles.requestModalHeader}>
                <Text style={styles.requestModalTitle}>📝 Request a Product</Text>
                <TouchableOpacity onPress={() => setShowRequestModal(false)}>
                  <Text style={styles.requestModalClose}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.requestModalHint}>
                  Tell us what you need and we'll find a distributor for you.
                </Text>

                <Text style={styles.formLabel}>Product Name *</Text>
                <TextInput
                  style={styles.formInput}
                  value={requestForm.productName}
                  onChangeText={(text) => setRequestForm({ ...requestForm, productName: text })}
                  placeholder="e.g., Coca-Cola"
                  placeholderTextColor="#ADB5BD"
                />

                <Text style={styles.formLabel}>Category</Text>
                <View style={styles.chipRow}>
                  {['Beverages', 'Noodles', 'Food', 'Snacks', 'Detergents', 'Other'].map(cat => (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.chip,
                        requestForm.category === cat && styles.chipActive,
                      ]}
                      onPress={() => setRequestForm({ ...requestForm, category: cat })}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          requestForm.category === cat && styles.chipTextActive,
                        ]}
                      >
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.formRow}>
                  <View style={styles.formHalf}>
                    <Text style={styles.formLabel}>Quantity</Text>
                    <TextInput
                      style={styles.formInput}
                      value={requestForm.quantity}
                      onChangeText={(text) => setRequestForm({ ...requestForm, quantity: text })}
                      placeholder="1"
                      placeholderTextColor="#ADB5BD"
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.formHalf}>
                    <Text style={styles.formLabel}>Unit</Text>
                    <View style={styles.chipRow}>
                      {['carton', 'pack', 'piece', 'kg', 'litre'].map(u => (
                        <TouchableOpacity
                          key={u}
                          style={[
                            styles.chip,
                            requestForm.unit === u && styles.chipActive,
                          ]}
                          onPress={() => setRequestForm({ ...requestForm, unit: u })}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              requestForm.unit === u && styles.chipTextActive,
                            ]}
                          >
                            {u}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>

                <Text style={styles.formLabel}>Notes (Optional)</Text>
                <TextInput
                  style={[styles.formInput, { minHeight: 60 }]}
                  value={requestForm.notes}
                  onChangeText={(text) => setRequestForm({ ...requestForm, notes: text })}
                  placeholder="e.g., Need it urgently"
                  placeholderTextColor="#ADB5BD"
                  multiline
                />

                <View style={styles.requestModalActions}>
                  <TouchableOpacity
                    style={styles.requestCancelButton}
                    onPress={() => setShowRequestModal(false)}
                  >
                    <Text style={styles.requestCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.requestSubmitButton, submittingRequest && { opacity: 0.6 }]}
                    onPress={submitProductRequest}
                    disabled={submittingRequest}
                  >
                    {submittingRequest ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.requestSubmitText}>📤 Submit</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
      {/* AI Results Modal */}
      {showAiModal && (
        <Modal visible={showAiModal} animationType="slide" transparent={false}>
          <SafeAreaView style={styles.chatContainer}>
            <View style={styles.chatHeader}>
              <TouchableOpacity onPress={() => { setShowAiModal(false); setAiResults([]); }}>
                <Text style={styles.chatBack}>← Back</Text>
              </TouchableOpacity>
              <View style={styles.chatHeaderInfo}>
                <Text style={styles.chatHeaderName}>🤖 AI Detected Products</Text>
                <Text style={styles.chatHeaderRole}>
                  {aiResults.filter(r => r.matched).length} of {aiResults.length} matched
                </Text>
              </View>
              <View style={{ width: 60 }} />
            </View>

            <ScrollView contentContainerStyle={{ padding: 16 }}>
              <Text style={styles.aiHint}>
                Review what we found. Uncheck anything you don't want, then add to cart.
              </Text>

              {aiResults.map((item, idx) => (
                <View key={idx} style={[styles.aiItem, !item.matched && styles.aiItemUnmatched]}>
                  <TouchableOpacity
                    style={styles.aiCheckbox}
                    onPress={() => item.matched && toggleAiSelection(idx)}
                    disabled={!item.matched}
                  >
                    <Text style={styles.aiCheckboxText}>
                      {!item.matched ? '⚠️' : item.selected ? '☑️' : '⬜'}
                    </Text>
                  </TouchableOpacity>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.aiDetected}>
                      Detected: {item.detectedName} × {item.detectedQty}
                    </Text>

                    {item.matched ? (
                      <>
                        <Text style={styles.aiMatched}>
                          ✅ {item.matched.name}
                          {item.matched.size ? ` • ${item.matched.size}` : ''}
                        </Text>
                        <Text style={styles.aiMatchedSub}>
                          ₦{item.matched.price?.toLocaleString()} from {item.matched.distributorName}
                        </Text>

                        <View style={styles.aiQtyRow}>
                          <TouchableOpacity
                            style={styles.qtyBtn}
                            onPress={() => updateAiQty(idx, -1)}
                          >
                            <Text style={styles.qtyBtnText}>−</Text>
                          </TouchableOpacity>
                          <Text style={styles.qtyValue}>{item.quantity}</Text>
                          <TouchableOpacity
                            style={styles.qtyBtn}
                            onPress={() => updateAiQty(idx, 1)}
                          >
                            <Text style={styles.qtyBtnText}>+</Text>
                          </TouchableOpacity>
                        </View>
                      </>
                    ) : (
                      <Text style={styles.aiNotFound}>
                        ⚠️ No distributor sells this — try "Request Product"
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </ScrollView>

            <View style={styles.cartFooter}>
              <View style={styles.cartTotalRow}>
                <Text style={styles.cartTotalLabel}>
                  Selected total:
                </Text>
                <Text style={styles.cartTotalValue}>
                  ₦{aiResults
                    .filter(r => r.selected && r.matched)
                    .reduce((sum, r) => sum + (r.matched?.price || 0) * r.quantity, 0)
                    .toLocaleString()}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.cartCheckoutButton}
                onPress={addAiResultsToCart}
              >
                <Text style={styles.cartCheckoutText}>
                  🛒 Add Selected to Cart
                </Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </Modal>
      )}
      {/* Notifications Modal */}
      {showNotificationsModal && (
        <Modal
          visible={showNotificationsModal}
          animationType="slide"
          transparent={false}
        >
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
                  <Text style={{ color: COLORS.gray, marginTop: 6, textAlign: 'center' }}>
                    You'll see updates about your orders here.
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
  cancelOrderButton: { backgroundColor: '#E17055', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 },
  cancelOrderButtonText: { color: '#FFFFFF', fontSize: 14 },
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
  // Notification preferences
  notifRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  notifLabel: { fontSize: 15, fontWeight: '600', color: COLORS.primary },
  notifHint: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
    // Shop tab
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
    gap: 12,
  },
  productStock: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  addButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.lightGray,
  },
  chipText: { fontSize: 13, color: COLORS.gray, fontWeight: '600' },
    // Dashboard redesign
  hero: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  heroGreeting: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    fontWeight: '500',
  },
  heroShop: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 2,
    marginBottom: 12,
  },
  heroTagline: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 15,
    marginBottom: 16,
  },
  heroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  heroButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  heroButtonArrow: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  heroEmoji: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    fontSize: 64,
    opacity: 0.1,
  },
  statCardNew: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  statIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statIconText: { fontSize: 18 },
  statNumberNew: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.primary,
  },
  statLabelNew: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 2,
    fontWeight: '500',
  },
  statTrend: {
    fontSize: 11,
    color: COLORS.secondary,
    marginTop: 6,
    fontWeight: '600',
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
    marginTop: 8,
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  seeAllText: {
    fontSize: 13,
    color: COLORS.secondary,
    fontWeight: '600',
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  actionCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  actionIconText: { fontSize: 22 },
  actionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  actionSubtitle: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 2,
  },
  recentOrderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    gap: 12,
  },
  recentOrderId: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 6,
  },
  statusPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  recentOrderTotal: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
  },
  recentOrderArrow: {
    fontSize: 16,
    color: COLORS.gray,
  },
  recCard: {
    width: 140,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  recImagePlaceholder: {
    height: 70,
    backgroundColor: COLORS.background,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  recEmoji: { fontSize: 32 },
  recName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
    minHeight: 34,
  },
  recPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.secondary,
    marginTop: 6,
  },
  recDist: {
    fontSize: 11,
    color: COLORS.gray,
    marginTop: 2,
  },
    // Cart
  qtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qtyBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  qtyBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.primary,
    lineHeight: 18,
  },
  qtyValue: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
    minWidth: 22,
    textAlign: 'center',
  },
  viewCartButton: {
    backgroundColor: COLORS.primary,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  viewCartButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  tabBadge: {
    position: 'absolute',
    top: -4,
    right: -10,
    backgroundColor: COLORS.danger,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  cartClearText: {
    color: COLORS.danger,
    fontSize: 14,
    fontWeight: '600',
  },
  cartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cartItemName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
  },
  cartItemDist: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 2,
  },
  cartItemPrice: {
    fontSize: 13,
    color: COLORS.secondary,
    fontWeight: '600',
    marginTop: 4,
  },
  cartItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cartItemRemove: {
    padding: 6,
  },
  cartItemRemoveText: {
    fontSize: 18,
  },
  cartFooter: {
    padding: 16,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
  },
  cartTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  cartTotalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.gray,
  },
  cartTotalValue: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.primary,
  },
  cartCheckoutButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  cartCheckoutText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
    // Order confirmation modal
  confirmModalCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 32,
    width: '88%',
    maxWidth: 400,
    alignItems: 'center',
  },
  confirmEmoji: {
    fontSize: 64,
    marginBottom: 12,
  },
  confirmTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.primary,
    marginBottom: 6,
  },
  confirmSubtitle: {
    fontSize: 14,
    color: COLORS.gray,
    textAlign: 'center',
    marginBottom: 20,
  },
  confirmNumbersBox: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 24,
    width: '100%',
  },
  confirmNumbersLabel: {
    fontSize: 12,
    color: COLORS.gray,
    fontWeight: '600',
    marginBottom: 6,
  },
  confirmNumbersText: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 1,
  },
  confirmButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
    marginBottom: 10,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  confirmSecondaryButton: {
    paddingVertical: 12,
    alignItems: 'center',
    width: '100%',
  },
  confirmSecondaryText: {
    color: COLORS.secondary,
    fontSize: 14,
    fontWeight: '600',
  },
    // Product not found
  noResultsCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  noResultsEmoji: {
    fontSize: 52,
    marginBottom: 12,
  },
  noResultsTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.primary,
    marginBottom: 8,
  },
  noResultsText: {
    fontSize: 14,
    color: COLORS.gray,
    textAlign: 'center',
    marginBottom: 4,
  },
  noResultsSubtext: {
    fontSize: 13,
    color: COLORS.gray,
    textAlign: 'center',
    marginBottom: 20,
  },
  requestButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  requestButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  // Request modal
  requestModalCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 24,
    width: '90%',
    maxWidth: 480,
    maxHeight: '85%',
  },
  requestModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  requestModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.primary,
  },
  requestModalClose: {
    fontSize: 24,
    color: COLORS.gray,
    paddingHorizontal: 6,
  },
  requestModalHint: {
    fontSize: 13,
    color: COLORS.gray,
    marginBottom: 16,
  },
  chipActive: {
    backgroundColor: COLORS.primary,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  requestModalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  requestCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.lightGray,
    alignItems: 'center',
  },
  requestCancelText: {
    color: COLORS.gray,
    fontWeight: '700',
    fontSize: 14,
  },
  requestSubmitButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  requestSubmitText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
    // AI upload button
  aiUploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6C5CE7',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    gap: 12,
  },
  aiUploadEmoji: { fontSize: 28 },
  aiUploadTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  aiUploadSubtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    marginTop: 2,
  },
  // AI results
  aiHint: {
    fontSize: 13,
    color: COLORS.gray,
    marginBottom: 16,
    textAlign: 'center',
  },
  aiItem: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  aiItemUnmatched: {
    borderWidth: 1,
    borderColor: '#FFA726',
    backgroundColor: '#FFF8E1',
  },
  aiCheckbox: {
    paddingTop: 2,
  },
  aiCheckboxText: {
    fontSize: 22,
  },
  aiDetected: {
    fontSize: 12,
    color: COLORS.gray,
    marginBottom: 4,
    fontStyle: 'italic',
  },
  aiMatched: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
  },
  aiMatchedSub: {
    fontSize: 13,
    color: COLORS.secondary,
    fontWeight: '600',
    marginTop: 2,
  },
  aiNotFound: {
    fontSize: 13,
    color: '#E65100',
    fontWeight: '600',
    marginTop: 4,
  },
  aiQtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
    // Orders improvements
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
  filterChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.lightGray,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
  },
  filterChipText: {
    fontSize: 13,
    color: COLORS.gray,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
    heroBell: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    padding: 6,
  },
  heroBellIcon: { fontSize: 24 },
  heroBellBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#E17055',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBellBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
    // Header actions
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
  // Notification rows
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
  markAllRead: {
    fontSize: 12,
    color: COLORS.secondary,
    fontWeight: '700',
  },
});