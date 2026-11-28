import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  ScrollView,
  SafeAreaView,
  Modal,
  TextInput,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { analizarApunteConGemini } from '../services/aiService';
import { guardarApunte, obtenerConfiguracion, guardarConfiguracion } from '../services/dbService';

export default function IndexScreen() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('image/jpeg');
  const [loading, setLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');

  // Modal de configuración de API Key / App Check
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const [apiKeyInput, setApiKeyInput] = useState<string>('');

  useEffect(() => {
    const savedKey = obtenerConfiguracion('gemini_api_key');
    if (savedKey) {
      setApiKeyInput(savedKey);
    }
  }, []);

  const handleGuardarApiKey = () => {
    guardarConfiguracion('gemini_api_key', apiKeyInput.trim());
    setShowConfigModal(false);
    Alert.alert('Configuración guardada', 'La API Key de Gemini ha sido actualizada correctamente.');
  };

  // 1. Manejo de la Cámara: Permisos, Cancelación y base64: true
  const handleTomarFoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== ImagePicker.PermissionStatus.GRANTED) {
        Alert.alert(
          'Permiso denegado',
          'Se necesita acceso a la cámara para tomar fotografías de tus apuntes. Puedes habilitarlo en los ajustes de tu dispositivo.'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        base64: true, // Requerimiento: opción base64 activada
        allowsEditing: true,
        quality: 0.8,
      });

      // Caso de cancelación: la app no crashea
      if (result.canceled) {
        return;
      }

      const asset = result.assets?.[0];
      if (asset?.base64) {
        setImageUri(asset.uri);
        setImageBase64(asset.base64);
        setMimeType(asset.mimeType || 'image/jpeg');
      } else {
        Alert.alert('Aviso', 'No se pudo obtener la información base64 de la imagen.');
      }
    } catch (error) {
      console.error('Error al tomar foto:', error);
      Alert.alert('Error', 'Ocurrió un problema inesperado al abrir la cámara.');
    }
  };

  // 2. Manejo de la Galería: base64: true y vista previa
  const handleElegirGaleria = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== ImagePicker.PermissionStatus.GRANTED) {
        Alert.alert(
          'Permiso denegado',
          'Se necesita permiso para acceder a tu galería de fotos.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        base64: true, // Requerimiento: opción base64 activada
        allowsEditing: true,
        quality: 0.8,
      });

      // Caso de cancelación
      if (result.canceled) {
        return;
      }

      const asset = result.assets?.[0];
      if (asset?.base64) {
        setImageUri(asset.uri);
        setImageBase64(asset.base64);
        setMimeType(asset.mimeType || 'image/jpeg');
      } else {
        Alert.alert('Aviso', 'No se pudo obtener la información base64 de la imagen.');
      }
    } catch (error) {
      console.error('Error al elegir de galería:', error);
      Alert.alert('Error', 'Ocurrió un problema al abrir la galería.');
    }
  };

  // 3. Envío a Gemini, ActivityIndicator, botones deshabilitados y manejo de errores
  const handleAnalizarConGemini = async () => {
    if (!imageBase64) {
      Alert.alert('Selecciona una imagen', 'Por favor toma una foto o elige una imagen de tu galería antes de analizar.');
      return;
    }

    setLoading(true);
    setStatusMessage('Gemini está analizando tu apunte...');

    try {
      const resultado = await analizarApunteConGemini(imageBase64, mimeType);

      // Verificación de caso: Foto borrosa o que no sea un apunte
      const esInvalido =
        resultado.titulo.toLowerCase().includes('no reconocid') ||
        resultado.titulo.toLowerCase().includes('borrosa') ||
        (resultado.conceptos_clave.length === 0 && resultado.preguntas.length === 0);

      if (esInvalido) {
        Alert.alert(
          'Foto no reconocida como apunte',
          'La imagen parece estar borrosa o no contiene apuntes educativos legibles. Por favor, asegúrate de enfocar con buena iluminación y vuelve a intentarlo.'
        );
        setLoading(false);
        setStatusMessage('');
        return;
      }

      // Guardar en la base de datos SQLite para persistencia e historial
      const nuevoId = guardarApunte(resultado, imageUri || undefined);

      setLoading(false);
      setStatusMessage('');

      // Navegación con Expo Router a la pantalla Resumen
      router.push({
        pathname: '/resumen',
        params: { id: nuevoId.toString() },
      });
    } catch (error: any) {
      setLoading(false);
      setStatusMessage('');
      console.error('Error al procesar con Gemini:', error);

      const mensaje = error?.message || 'Ocurrió un error inesperado al analizar el apunte.';

      if (mensaje.includes('403') || mensaje.includes('401') || mensaje.includes('App Check')) {
        Alert.alert(
          'Configuración de Acceso Requerida',
          mensaje,
          [
            { text: 'Cerrar', style: 'cancel' },
            {
              text: 'Configurar API Key ⚙️',
              onPress: () => setShowConfigModal(true),
            },
          ]
        );
      } else {
        Alert.alert('Aviso al Analizar', mensaje);
      }
    }
  };

  const handleLimpiarImagen = () => {
    setImageUri(null);
    setImageBase64(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Encabezado con botón de ajustes */}
        <View style={styles.headerCard}>
          <View style={styles.headerTopRow}>
            <View style={styles.headerBadge}>
              <Ionicons name="sparkles" size={14} color="#1E40AF" />
              <Text style={styles.headerBadgeText}>Google Gemini</Text>
            </View>
            <TouchableOpacity
              style={styles.settingsButton}
              onPress={() => setShowConfigModal(true)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="settings-outline" size={22} color="#1E40AF" />
            </TouchableOpacity>
          </View>

          <Ionicons name="school-outline" size={36} color="#1E40AF" />
          <Text style={styles.title}>FotoApuntes IA</Text>
          <Text style={styles.subtitle}>
            Toma foto a tus notas de estudio o elige de tu galería. Gemini generará un resumen estructurado, conceptos clave y un quiz interactivo.
          </Text>
        </View>

        {/* Vista previa de imagen con <Image> */}
        {imageUri ? (
          <View style={styles.previewContainer}>
            <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="cover" />
            {!loading && (
              <TouchableOpacity style={styles.removeImageButton} onPress={handleLimpiarImagen}>
                <Ionicons name="close-circle" size={28} color="#EF4444" />
                <Text style={styles.removeImageText}>Cambiar foto</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.placeholderContainer}>
            <Ionicons name="image-outline" size={64} color="#94A3B8" />
            <Text style={styles.placeholderText}>No has seleccionado ningún apunte</Text>
            <Text style={styles.placeholderSubtext}>Toma una foto o selecciónala de la galería</Text>
          </View>
        )}

        {/* Indicador de carga y mensaje de estado */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1E40AF" />
            <Text style={styles.loadingText}>{statusMessage || 'Procesando apunte con Gemini...'}</Text>
          </View>
        )}

        {/* Botones de acción principales */}
        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={[styles.actionButton, styles.cameraButton, loading && styles.buttonDisabled]}
            onPress={handleTomarFoto}
            disabled={loading} // Requerimiento: deshabilitar botones mientras llega la respuesta
            activeOpacity={0.8}
          >
            <Ionicons name="camera" size={24} color="#ffffff" style={styles.buttonIcon} />
            <Text style={styles.buttonText}>Tomar foto</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.galleryButton, loading && styles.buttonDisabled]}
            onPress={handleElegirGaleria}
            disabled={loading} // Requerimiento: deshabilitar botones mientras llega la respuesta
            activeOpacity={0.8}
          >
            <Ionicons name="images" size={24} color="#ffffff" style={styles.buttonIcon} />
            <Text style={styles.buttonText}>Elegir de galería</Text>
          </TouchableOpacity>
        </View>

        {/* Botón para enviar a Gemini */}
        {imageUri && (
          <TouchableOpacity
            style={[styles.analyzeButton, loading && styles.buttonDisabled]}
            onPress={handleAnalizarConGemini}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Ionicons name="sparkles" size={22} color="#ffffff" style={styles.buttonIcon} />
                <Text style={styles.analyzeButtonText}>Analizar apunte con Gemini</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Navegación al Historial */}
        <TouchableOpacity
          style={[styles.historyButton, loading && styles.buttonDisabled]}
          onPress={() => router.push('/historial')}
          disabled={loading}
          activeOpacity={0.8}
        >
          <Ionicons name="time-outline" size={22} color="#1E40AF" style={styles.buttonIcon} />
          <Text style={styles.historyButtonText}>Ver Historial de Apuntes</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Modal de Configuración de API Key */}
      <Modal
        visible={showConfigModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowConfigModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons name="key" size={24} color="#1E40AF" />
              <Text style={styles.modalTitle}>Ajustes de Gemini API</Text>
              <TouchableOpacity onPress={() => setShowConfigModal(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDescription}>
              Si tu proyecto de Firebase tiene restricciones o App Check activo, puedes ingresar una API Key gratuita de Google AI Studio (aistudio.google.com):
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Pega aquí tu Gemini API Key (AIza...)"
              placeholderTextColor="#94A3B8"
              value={apiKeyInput}
              onChangeText={setApiKeyInput}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry={false}
            />

            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={18} color="#0284C7" />
              <Text style={styles.infoBoxText}>
                Token de depuración Firebase App Check para tu emulador:
                {'\n'}
                <Text style={{ fontWeight: 'bold' }}>4a9de0b3-f6a8-4562-b477-38a79d53e355</Text>
              </Text>
            </View>

            <View style={styles.modalButtonsRow}>
              {apiKeyInput.trim().length > 0 && (
                <TouchableOpacity
                  style={styles.clearKeyButton}
                  onPress={() => {
                    setApiKeyInput('');
                    guardarConfiguracion('gemini_api_key', '');
                    Alert.alert('Eliminada', 'Se restableció al backend predeterminado de Firebase.');
                  }}
                >
                  <Text style={styles.clearKeyButtonText}>Restablecer</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.saveKeyButton} onPress={handleGuardarApiKey}>
                <Text style={styles.saveKeyButtonText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 20,
    alignItems: 'center',
  },
  headerCard: {
    width: '100%',
    backgroundColor: '#EFF6FF',
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  headerTopRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
  },
  headerBadgeText: {
    fontSize: 11,
    color: '#1E40AF',
    fontWeight: '600',
  },
  settingsButton: {
    padding: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1E3A8A',
    marginTop: 6,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20,
  },
  previewContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  previewImage: {
    width: '100%',
    height: 280,
    borderRadius: 16,
    backgroundColor: '#E2E8F0',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  removeImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    padding: 6,
  },
  removeImageText: {
    fontSize: 14,
    color: '#EF4444',
    marginLeft: 6,
    fontWeight: '600',
  },
  placeholderContainer: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  placeholderText: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
  },
  placeholderSubtext: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
    width: '100%',
    justifyContent: 'center',
  },
  loadingText: {
    marginLeft: 10,
    color: '#1E40AF',
    fontWeight: '600',
    fontSize: 14,
  },
  buttonsContainer: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  cameraButton: {
    backgroundColor: '#2563EB',
    marginRight: 8,
  },
  galleryButton: {
    backgroundColor: '#0D9488',
    marginLeft: 8,
  },
  buttonIcon: {
    marginRight: 6,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  analyzeButton: {
    width: '100%',
    flexDirection: 'row',
    backgroundColor: '#7C3AED',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  analyzeButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  historyButton: {
    width: '100%',
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#1E40AF',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  historyButtonText: {
    color: '#1E40AF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
    flex: 1,
    marginLeft: 8,
  },
  modalDescription: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 14,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 12,
    backgroundColor: '#F8FAFC',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
    gap: 8,
  },
  infoBoxText: {
    fontSize: 12,
    color: '#0369A1',
    flex: 1,
    lineHeight: 16,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  clearKeyButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  clearKeyButtonText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '600',
  },
  saveKeyButton: {
    backgroundColor: '#1E40AF',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  saveKeyButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
