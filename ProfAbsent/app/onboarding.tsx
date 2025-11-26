import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../utils/useAuth';

const { width } = Dimensions.get('window');

interface Slide {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  color: string;
}

const slides: Slide[] = [
  {
    id: 1,
    title: 'Bienvenue sur ProfAbsent',
    subtitle: 'Simplifiez la gestion de vos absences',
    description: 'Une application moderne pour gérer facilement vos demandes d\'absence professionnelles en quelques clics.',
    icon: 'school-outline',
    color: '#3498db'
  },
  {
    id: 2,
    title: 'Demandes simplifiées',
    subtitle: 'Créez vos demandes en toute simplicité',
    description: 'Sélectionnez votre type d\'absence, définissez les dates et ajoutez un motif. Votre demande est automatiquement envoyée à votre hiérarchie.',
    icon: 'document-text-outline',
    color: '#9b59b6'
  },
  {
    id: 3,
    title: 'Suivi en temps réel',
    subtitle: 'Suivez l\'état de vos demandes',
    description: 'Consultez le statut de vos demandes : en attente, approuvées ou refusées. Recevez des notifications pour chaque mise à jour.',
    icon: 'checkmark-circle-outline',
    color: '#27ae60'
  },
  {
    id: 4,
    title: 'Profil personnalisé',
    subtitle: 'Gérez vos informations',
    description: 'Maintenez à jour vos informations personnelles et professionnelles. Consultez votre solde de congés et votre historique.',
    icon: 'person-outline',
    color: '#f39c12'
  }
];

export default function Onboarding() {
  const router = useRouter();
  const { completeOnboarding } = useAuth();
  const scrollViewRef = useRef<ScrollView>(null);
  const [currentSlide, setCurrentSlide] = useState(0);

  const handleScroll = (event: any) => {
    const slideWidth = width;
    const currentIndex = Math.round(event.nativeEvent.contentOffset.x / slideWidth);
    setCurrentSlide(currentIndex);
  };

  const nextSlide = () => {
    if (currentSlide < slides.length - 1) {
      const nextIndex = currentSlide + 1;
      scrollViewRef.current?.scrollTo({
        x: nextIndex * width,
        animated: true,
      });
      setCurrentSlide(nextIndex);
    } else {
      finishOnboarding();
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      const prevIndex = currentSlide - 1;
      scrollViewRef.current?.scrollTo({
        x: prevIndex * width,
        animated: true,
      });
      setCurrentSlide(prevIndex);
    }
  };

  const skipOnboarding = () => {
    finishOnboarding();
  };

  const finishOnboarding = async () => {
    try {
      await completeOnboarding();
      router.replace('/register');
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      router.replace('/register');
    }
  };

  const renderSlide = (slide: Slide, index: number) => (
    <View key={slide.id} style={[styles.slide, { width }]}>
      <LinearGradient
        colors={[slide.color + '20', slide.color + '10']}
        style={styles.iconContainer}
      >
        {slide.id === 1 ? (
          <Image
            source={require('../assets/images/ProfAbsent.png')}
            style={styles.logoImage}
            resizeMode="cover"
          />
        ) : (
          <Ionicons name={slide.icon as any} size={80} color={slide.color} />
        )}
      </LinearGradient>
      
      <View style={styles.textContainer}>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.subtitle}>{slide.subtitle}</Text>
        <Text style={styles.description}>{slide.description}</Text>
      </View>
    </View>
  );

  const renderDots = () => (
    <View style={styles.dotsContainer}>
      {slides.map((_, index) => (
        <View
          key={index}
          style={[
            styles.dot,
            {
              backgroundColor: currentSlide === index ? '#3498db' : '#bdc3c7',
              width: currentSlide === index ? 24 : 8,
            }
          ]}
        />
      ))}
    </View>
  );

  return (
    <LinearGradient
      colors={['#f8f9fa', '#ecf0f1']}
      style={styles.container}
    >
      {/* Header avec bouton Skip */}
      <View style={styles.header}>
        <TouchableOpacity onPress={skipOnboarding} style={styles.skipButton}>
          <Text style={styles.skipText}>Passer</Text>
        </TouchableOpacity>
      </View>

      {/* Slides */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        style={styles.scrollView}
      >
        {slides.map(renderSlide)}
      </ScrollView>

      {/* Dots indicator */}
      {renderDots()}

      {/* Navigation buttons */}
      <View style={styles.navigationContainer}>
        <TouchableOpacity
          onPress={prevSlide}
          style={[
            styles.navButton,
            styles.prevButton,
            currentSlide === 0 && styles.navButtonDisabled
          ]}
          disabled={currentSlide === 0}
        >
          <Ionicons 
            name="chevron-back" 
            size={24} 
            color={currentSlide === 0 ? '#bdc3c7' : '#3498db'} 
          />
        </TouchableOpacity>

        {currentSlide === slides.length - 1 ? (
          <TouchableOpacity onPress={nextSlide} style={styles.finishButtonWrapper}>
            <LinearGradient
              colors={['#3498db', '#2980b9']}
              style={styles.finishButton}
            >
              <Text style={styles.finishButtonText}>Commencer</Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={nextSlide} style={styles.nextButton}>
            <LinearGradient
              colors={['#3498db', '#2980b9']}
              style={styles.nextButtonGradient}
            >
              <Ionicons name="chevron-forward" size={24} color="white" />
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 50,
    paddingHorizontal: 20,
    alignItems: 'flex-end',
  },
  skipButton: {
    padding: 8,
  },
  skipText: {
    fontSize: 16,
    color: '#7f8c8d',
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  iconContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  textContainer: {
    alignItems: 'center',
    maxWidth: 320,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2c3e50',
    textAlign: 'center',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3498db',
    textAlign: 'center',
    marginBottom: 20,
  },
  description: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    lineHeight: 24,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  navigationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  navButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  prevButton: {
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  navButtonDisabled: {
    backgroundColor: '#f8f9fa',
    borderColor: '#e9ecef',
  },
  nextButton: {
    width: 56,
    height: 56,
  },
  nextButtonGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3498db',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  finishButtonWrapper: {
    // Wrapper sans contrainte de taille pour le bouton “Commencer”
    // afin d'éviter le layout 56x56 prévu pour la flèche
    alignSelf: 'flex-end',
    borderRadius: 28,
  },
  logoImage: {
    width: 150,
    height: 150,
    borderRadius: 75,
  },
  finishButton: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3498db',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  finishButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
});