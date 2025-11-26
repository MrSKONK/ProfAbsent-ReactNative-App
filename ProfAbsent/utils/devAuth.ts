// Mode de développement pour tester sans Supabase
export const DEV_MODE = false; // Changer à false pour utiliser Supabase en production

// Données de test pour le mode développement
export const DEV_CREDENTIALS = {
  email: 'test@test.com',
  password: 'password123'
};

// Utilisateurs de test supplémentaires
export const DEV_USERS = [
  {
    email: 'prof@test.com',
    password: 'prof123',
    fullName: 'Jean Professeur',
    role: 'Professeur',
    departement: 'Informatique'
  },
  {
    email: 'admin@test.com',
    password: 'admin123',
    fullName: 'Marie Admin',
    role: 'Gestionnaire',
    departement: 'Direction'
  },
  {
    email: DEV_CREDENTIALS.email,
    password: DEV_CREDENTIALS.password,
    fullName: 'Utilisateur Test',
    role: 'Personnel Administratif',
    departement: 'Test'
  }
];

// Fonction de connexion en mode développement
export const devLogin = async (email: string, password: string) => {
  await new Promise(resolve => setTimeout(resolve, 1000)); // Simule un délai réseau
  
  const user = DEV_USERS.find(u => u.email === email.toLowerCase() && u.password === password);
  
  if (user) {
    return { 
      success: true, 
      user: { 
        email: user.email, 
        id: `dev-user-${Date.now()}`,
        fullName: user.fullName,
        role: user.role,
        departement: user.departement
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
  
  // Vérifier si l'utilisateur existe déjà
  const existingUser = DEV_USERS.find(u => u.email === email.toLowerCase());
  
  if (existingUser) {
    return {
      success: false,
      error: 'Un compte existe déjà avec cette adresse email.'
    };
  }
  
  // Validation simple du mot de passe
  if (password.length < 6) {
    return {
      success: false,
      error: 'Le mot de passe doit contenir au moins 6 caractères.'
    };
  }
  
  return { 
    success: true, 
    user: { 
      email: email.toLowerCase(), 
      id: `dev-user-${Date.now()}`,
      fullName: fullName.trim(),
      role: role
    } 
  };
};