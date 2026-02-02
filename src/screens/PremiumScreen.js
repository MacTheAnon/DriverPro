import { Ionicons } from '@expo/vector-icons';
import { useContext, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { UserContext } from '../context/UserContext';
import COLORS from '../styles/colors';
import SubscriptionManager from '../utils/SubscriptionManager';

const PremiumScreen = ({ navigation }) => {
  // 1. Get 'isPremium' and 'refreshPremiumStatus'
  const { isPremium, refreshPremiumStatus } = useContext(UserContext);
  
  const [packages, setPackages] = useState([]);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Only load offers if NOT premium
    if (!isPremium) {
      const loadOffer = async () => {
        setLoading(true);
        const packs = await SubscriptionManager.getOfferings();
        setPackages(packs);
        if (packs.length > 0) {
          const annual = packs.find(p => p.packageType === 'ANNUAL');
          setSelectedPackage(annual || packs[0]);
        }
        setLoading(false);
      };
      loadOffer();
    }
  }, [isPremium]);

  const handleSubscribe = async () => {
    if (!selectedPackage) return Alert.alert("Error", "Please select a plan.");
    
    // 1. Run Purchase
    const success = await SubscriptionManager.purchase(selectedPackage);
    
    // 2. If successful, force update and move screen
    if (success) {
      await refreshPremiumStatus();
      Alert.alert(
        "Welcome Aboard! 🚀", 
        "Your Pro features are now active.",
        [
          { text: "Let's Go", onPress: () => navigation.navigate('Dashboard')}
        ]
      );
    }
  };

  const handleRestore = async () => {
    const success = await SubscriptionManager.restore();
    if (success) {
      await refreshPremiumStatus();
      Alert.alert("Restored", "Your Pro status is back!");
      navigation.navigate('Dashboard');
    } else {
      Alert.alert("Notice", "No active subscription found.");
    }
  };

  const openLink = (url) => Linking.openURL(url);

  // --- VIEW: ALREADY PREMIUM ---
  if (isPremium) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Ionicons name="checkmark-circle" size={100} color={COLORS.success} />
        <Text style={styles.title}>You are a Pro!</Text>
        <Text style={styles.subtitle}>All advanced features are unlocked.</Text>
        
        <View style={styles.activeCard}>
          <Text style={styles.activeTitle}>DriverPro+ Active</Text>
          <Text style={styles.activeSub}>Thank you for supporting the app.</Text>
        </View>

        <TouchableOpacity 
          style={[styles.subscribeButton, { backgroundColor: '#333', marginTop: 30, width: '80%' }]} 
          onPress={() => navigation.navigate('Dashboard')}
        >
          <Text style={styles.subscribeText}>Go to Dashboard</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => Linking.openURL('https://apps.apple.com/account/subscriptions')} style={{ marginTop: 20 }}>
          <Text style={styles.footerLink}>Manage Subscription</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // --- VIEW: SALES PAGE ---
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Ionicons name="trophy" size={80} color="#FFD700" />
        <Text style={styles.title}>Unlock DriverPro+</Text>
        <Text style={styles.subtitle}>Audit-proof your taxes with professional tools.</Text>
      </View>

      <View style={styles.benefitsContainer}>
        <BenefitItem icon="document-text" title="IRS-Compliant PDF Reports" desc="Export detailed logs for your accountant." />
        <BenefitItem icon="pie-chart" title="Advanced Analytics" desc="See exactly where your money goes." />
        <BenefitItem icon="infinite" title="Unlimited Receipt Scans" desc="Store every expense safely." />
        <BenefitItem icon="time" title="Smart Work Schedules" desc="Auto-tag trips as Business during your set hours." />
      </View>

      <Text style={styles.sectionTitle}>Choose Your Plan</Text>
      
      {loading ? (
        <ActivityIndicator size="large" color="#2e7d32" />
      ) : (
        packages.map((pack) => {
          const isSelected = selectedPackage?.identifier === pack.identifier;
          return (
            <TouchableOpacity 
              key={pack.identifier} 
              style={[styles.planCard, isSelected && styles.selectedPlan]}
              onPress={() => setSelectedPackage(pack)}
            >
              <View>
                <Text style={[styles.planName, isSelected && styles.selectedText]}>{pack.product.title}</Text>
                <Text style={styles.planDesc}>{pack.product.description}</Text>
              </View>
              <Text style={[styles.planPrice, isSelected && styles.selectedText]}>{pack.product.priceString}</Text>
            </TouchableOpacity>
          );
        })
      )}

      <TouchableOpacity style={styles.subscribeButton} onPress={handleSubscribe}>
        <Text style={styles.subscribeText}>
          {selectedPackage?.packageType === 'LIFETIME' ? "Unlock Forever" : "Start Free Trial"}
        </Text>
      </TouchableOpacity>
      
      <Text style={styles.cancelAnytime}>Cancel anytime via App Store settings.</Text>

      <View style={styles.footer}>
        <TouchableOpacity onPress={handleRestore}><Text style={styles.footerLink}>Restore Purchases</Text></TouchableOpacity>
        <View style={styles.separator} />
        <TouchableOpacity onPress={() => openLink('https://github.com/MacTheAnon/DriverPro/blob/master/terms_of_use.md')}><Text style={styles.footerLink}>Terms</Text></TouchableOpacity>
        <View style={styles.separator} />
        <TouchableOpacity onPress={() => openLink('https://github.com/MacTheAnon/DriverPro/blob/master/Privacy_Policy.md')}><Text style={styles.footerLink}>Privacy</Text></TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const BenefitItem = ({ icon, title, desc }) => (
  <View style={styles.benefitItem}>
    <Ionicons name={icon} size={28} color="#2e7d32" style={{ marginRight: 15 }} />
    <View style={{ flex: 1 }}>
      <Text style={styles.benefitTitle}>{title}</Text>
      <Text style={styles.benefitDesc}>{desc}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#fff', padding: 20, paddingTop: 60 },
  header: { alignItems: 'center', marginBottom: 30 },
  title: { fontSize: 28, fontWeight: 'bold', marginTop: 10, color: '#333' },
  subtitle: { fontSize: 16, color: '#666', textAlign: 'center', marginTop: 5 },
  benefitsContainer: { marginBottom: 20 },
  benefitItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  benefitTitle: { fontSize: 16, fontWeight: '600', color: '#333' },
  benefitDesc: { fontSize: 13, color: '#888' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, marginTop: 10 },
  planCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, marginBottom: 10, borderRadius: 12, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#f9f9f9' },
  selectedPlan: { borderColor: '#2e7d32', backgroundColor: '#e8f5e9', borderWidth: 2 },
  planName: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  planDesc: { fontSize: 12, color: '#666' },
  planPrice: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  selectedText: { color: '#2e7d32' },
  subscribeButton: { backgroundColor: '#2e7d32', paddingVertical: 16, borderRadius: 30, alignItems: 'center', marginTop: 20, shadowColor: "#000", shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.2 },
  subscribeText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  cancelAnytime: { fontSize: 12, color: '#999', textAlign: 'center', marginTop: 10 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 30, marginBottom: 20 },
  footerLink: { color: '#999', fontSize: 12 },
  separator: { width: 1, height: 12, backgroundColor: '#ccc', marginHorizontal: 15 },
  
  // Active State Styles
  activeCard: { backgroundColor: '#e8f5e9', padding: 20, borderRadius: 15, width: '100%', alignItems: 'center', marginTop: 30, borderWidth: 1, borderColor: '#2e7d32' },
  activeTitle: { color: '#2e7d32', fontSize: 20, fontWeight: 'bold' },
  activeSub: { color: '#555', marginTop: 5 }
});

export default PremiumScreen;