import { useFonts as useExpoFonts } from 'expo-font';

export function useFonts() {
  const [fontsLoaded] = useExpoFonts({
   //Montserrat - Variable fonts
   'Montserrat': require('@/assets/fonts/Montserrat/Montserrat-VariableFont_wght.ttf'),
   'Montserrat-Italic': require('@/assets/fonts/Montserrat/Montserrat-Italic-VariableFont_wght.ttf'),

   // Lexend Deca - Variable fonts
   'Lexend': require('@/assets/fonts/Lexend/Lexend-VariableFont_wght.ttf'),

   // Quicksand - Variable font
   'Quicksand': require('@/assets/fonts/Quicksand/Quicksand-VariableFont_wght.ttf'),
   
   // Inter - Variable fonts
   'Inter': require('@/assets/fonts/Inter/Inter-VariableFont_opsz,wght.ttf'),
   'Inter-Italic': require('@/assets/fonts/Inter/Inter-Italic-VariableFont_opsz,wght.ttf'),
   
   // Coming Soon - Single weight
   'ComingSoon-Regular': require('@/assets/fonts/ComingSoon/ComingSoon-Regular.ttf'),
  });
   
  return fontsLoaded;
} 