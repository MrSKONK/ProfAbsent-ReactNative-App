// Mode de développement pour tester sans Supabase
export const DEV_MODE = false; // Changer à false pour utiliser Supabase

// Données de test pour le mode développement
export const DEV_CREDENTIALS = {
  email: 'test@test.com',
  password: 'password123'
};

// Fonction de connexion en mode développement
export const devLogin = async (email: string, password: string) => {
  await new Promise(resolve => setTimeout(resolve, 1000)); // Simule un délai réseau
  
  if (email === DEV_CREDENTIALS.email && password === DEV_CREDENTIALS.password) {
    return { 
      success: true, 
      user: { 
        email, 
        id: 'dev-user-id',
        role: 'Professeur'
      } 
    };
  }
  
  return { 
    success: false, 
    error: 'Email ou mot de passe incorrect' 
  };
};

// Fonction d'inscription en mode développement
export const devRegister = async (email: string, password: string, fullName: string, role: string) => {
  await new Promise(resolve => setTimeout(resolve, 1000)); // Simule un délai réseau
  
  return { 
    success: true, 
    user: { 
      email, 
      id: 'dev-user-id',
      fullName,
      role
    } 
  };
};