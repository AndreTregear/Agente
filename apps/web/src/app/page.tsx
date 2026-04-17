'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  Brain, 
  MessageSquare, 
  ArrowRight, 
  Star, 
  Check, 
  Menu, 
  X, 
  TrendingUp, 
  Users, 
  Zap,
  Shield,
  Clock,
  Target,
  FileBarChart,
  DollarSign,
  Calendar,
  Activity,
  Baby,
  Heart,
  Building2,
  BarChart3,
  CreditCard,
  Package,
  Smartphone,
  Globe,
  ExternalLink,
  Database,
  Cpu,
  Mic
} from 'lucide-react'

export default function LandingPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [scrollY, setScrollY] = useState(0)

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const whatsappDemo1 = [
    { sender: "user", message: "¿Cuánto vendí ayer?", time: "10:32" },
    { sender: "agent", message: "📊 *Reporte de Ventas - 3 Abril*\n\n💰 *Total vendido:* S/. 2,847\n📦 *Productos:* 45 unidades\n👥 *Clientes atendidos:* 23\n\n*Productos top:*\n1️⃣ Leche Gloria - S/. 340\n2️⃣ Pan integral - S/. 280\n3️⃣ Yogurt Laive - S/. 195\n\n¿Quieres ver el detalle por horas?", time: "10:32" }
  ]

  const whatsappDemo2 = [
    { sender: "user", message: "Mi bebé de 8 meses pesa 7.5kg. ¿Está bien?", time: "14:15" },
    { sender: "agent", message: "👶 *Evaluación de Crecimiento*\n\n✅ *Peso normal* para 8 meses\n📏 Z-score: -0.5 (rango saludable)\n\n🥄 *Para prevenir anemia:*\n• Sangrecita 2 veces/semana\n• Hígado de pollo con limón\n• Cushuro en mazamorra\n\n💊 Continúa con hierro en gotas\n📅 Próximo control: 15 abril", time: "14:16" }
  ]

  const techLogos = [
    { name: "PostgreSQL", icon: Database },
    { name: "Redis", icon: Cpu },
    { name: "vLLM", icon: Brain },
    { name: "Whisper", icon: Mic },
    { name: "Baileys", icon: MessageSquare },
    { name: "Cal.com", icon: Calendar }
  ]

  const impactStats = [
    {
      number: "40M+",
      label: "Pequeñas empresas LATAM",
      description: "Mercado objetivo de micro-empresarios"
    },
    {
      number: "43.7%",
      label: "Anemia infantil en Perú",
      description: "Problema que agente.fit puede resolver"
    },
    {
      number: "90%+",
      label: "Penetración WhatsApp",
      description: "Plataforma universal en LATAM"
    },
    {
      number: "100%",
      label: "Código Abierto",
      description: "Transparencia y privacidad total"
    }
  ]

  const agenteCeoFeatures = [
    { icon: TrendingUp, title: "Gestión de Ventas", desc: "CRM y seguimiento automático por WhatsApp" },
    { icon: FileBarChart, title: "Facturación Electrónica", desc: "SUNAT, DIAN, SAT, SEFAZ automática" },
    { icon: CreditCard, title: "Pagos Integrados", desc: "Yape, Plin, bancos con validación automática" },
    { icon: Package, title: "Control de Inventario", desc: "Stock en tiempo real y alertas automáticas" },
    { icon: Users, title: "CRM Inteligente", desc: "Historial de clientes y recomendaciones" },
    { icon: BarChart3, title: "Analytics", desc: "Reportes diarios y predicciones con IA" },
    { icon: Calendar, title: "Programación", desc: "Citas automáticas con Cal.com" },
    { icon: Mic, title: "Mensajes de Voz", desc: "Transcripción y procesamiento automático" }
  ]

  const agenteFitFeatures = [
    { icon: Baby, title: "Crecimiento Infantil", desc: "Z-scores OMS y seguimiento personalizado" },
    { icon: Heart, title: "Prevención Anemia", desc: "Superfoods peruanos y guías nutricionales" },
    { icon: Activity, title: "Salud Materna", desc: "Embarazo, lactancia y desarrollo temprano" },
    { icon: Brain, title: "Salud Mental", desc: "Apoyo psicológico y manejo del estrés" },
    { icon: Target, title: "Enfermedades Crónicas", desc: "Diabetes, hipertensión, prevención" },
    { icon: Globe, title: "Multidioma", desc: "Español y quechua nativo" }
  ]

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrollY > 50 ? 'glass-card-strong' : 'bg-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-cyan-500"></div>
                <Brain className="w-6 h-6 text-white relative z-10" />
              </div>
              <span className="text-2xl font-bold gradient-text">Agente</span>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              <a href="#whatsapp" className="text-gray-300 hover:text-white smooth-transition">¿Por qué WhatsApp?</a>
              <a href="#productos" className="text-gray-300 hover:text-white smooth-transition">Productos</a>
              <a href="#impacto" className="text-gray-300 hover:text-white smooth-transition">Impacto</a>
              <a href="#precios" className="text-gray-300 hover:text-white smooth-transition">Precios</a>
              <div className="flex items-center space-x-4">
                <a href="https://biz.yaya.sh" target="_blank" rel="noopener noreferrer" className="btn-secondary">
                  Para tu negocio
                </a>
                <a
                  href={`https://wa.me/${process.env.NEXT_PUBLIC_HEALTH_PHONE || '51999888777'}?text=${encodeURIComponent('Hola, quiero evaluar la salud de mi hijo')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-gradient"
                >
                  Prueba Agente Fit
                </a>
              </div>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 rounded-lg glass-card"
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="md:hidden glass-card-strong mt-2 mx-4 rounded-xl"
          >
            <div className="px-6 py-4 space-y-4">
              <a href="#whatsapp" className="block text-gray-300 hover:text-white">¿Por qué WhatsApp?</a>
              <a href="#productos" className="block text-gray-300 hover:text-white">Productos</a>
              <a href="#impacto" className="block text-gray-300 hover:text-white">Impacto</a>
              <a href="#precios" className="block text-gray-300 hover:text-white">Precios</a>
              <div className="space-y-3 pt-4 border-t border-white/10">
                <a href="https://biz.yaya.sh" target="_blank" rel="noopener noreferrer" className="btn-secondary w-full">
                  Para tu negocio
                </a>
                <a
                  href={`https://wa.me/${process.env.NEXT_PUBLIC_HEALTH_PHONE || '51999888777'}?text=${encodeURIComponent('Hola, quiero evaluar la salud de mi hijo')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-gradient w-full"
                >
                  Prueba Agente Fit
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center hero-gradient overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="space-y-6"
            >
              <h1 className="text-5xl md:text-7xl font-bold leading-tight">
                <span className="gradient-text-hero">Agentes de IA</span>
                <br />
                <span className="text-white">para Latinoamérica</span>
              </h1>
              <p className="text-xl md:text-2xl text-gray-300 max-w-4xl mx-auto leading-relaxed">
                <span className="block text-white font-semibold mb-2">
                  AI Agents for Latin America
                </span>
                <span className="text-cyan-400">Privacy-first. Open source. Built on WhatsApp.</span>
                <br />
                Transforma tu negocio y salud con inteligencia artificial que habla tu idioma.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <a href="https://biz.yaya.sh" target="_blank" rel="noopener noreferrer" className="btn-cta">
                <Building2 className="w-5 h-5" />
                Para tu negocio
                <ArrowRight className="w-5 h-5" />
              </a>
              <a
                href={`https://wa.me/${process.env.NEXT_PUBLIC_HEALTH_PHONE || '51999888777'}?text=${encodeURIComponent('Hola, quiero evaluar la salud de mi hijo')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-gradient"
              >
                <Heart className="w-5 h-5" />
                Prueba Agente Fit gratis
                <ArrowRight className="w-5 h-5" />
              </a>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 0.6 }}
              className="flex items-center justify-center space-x-8 text-sm text-gray-400"
            >
              <div className="flex items-center space-x-2">
                <Shield className="w-4 h-4 text-green-400" />
                <span>100% Código Abierto</span>
              </div>
              <div className="flex items-center space-x-2">
                <MessageSquare className="w-4 h-4 text-blue-400" />
                <span>Solo por WhatsApp</span>
              </div>
              <div className="flex items-center space-x-2">
                <Globe className="w-4 h-4 text-purple-400" />
                <span>Español & Quechua</span>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Floating Elements */}
        <div className="absolute top-20 left-10 w-20 h-20 glass-card rounded-full flex items-center justify-center float-animation">
          <Brain className="w-8 h-8 text-purple-400" />
        </div>
        <div className="absolute bottom-20 right-10 w-16 h-16 glass-card rounded-full flex items-center justify-center float-animation" style={{ animationDelay: '-2s' }}>
          <MessageSquare className="w-6 h-6 text-cyan-400" />
        </div>
        <div className="absolute top-1/2 right-20 w-12 h-12 glass-card rounded-full flex items-center justify-center float-animation" style={{ animationDelay: '-1s' }}>
          <Heart className="w-5 h-5 text-emerald-400" />
        </div>
      </section>

      {/* Why WhatsApp Section */}
      <section id="whatsapp" className="py-24 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold gradient-text mb-6">
              ¿Por qué WhatsApp?
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              La plataforma que ya conoces y usas todos los días
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="glass-card p-8 text-center glow-hover smooth-transition"
            >
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center mx-auto mb-6">
                <Smartphone className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-4">90%+ Penetración en LATAM</h3>
              <p className="text-gray-300 leading-relaxed">
                WhatsApp es la aplicación más usada en América Latina. 
                Nuestros agentes trabajan donde ya estás.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="glass-card p-8 text-center glow-hover smooth-transition"
            >
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mx-auto mb-6">
                <Zap className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Sin Aplicaciones Nuevas</h3>
              <p className="text-gray-300 leading-relaxed">
                Cero curva de aprendizaje. No descargas, no registros complicados.
                Solo escribe a tu agente y funciona.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="glass-card p-8 text-center glow-hover smooth-transition"
            >
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mx-auto mb-6">
                <MessageSquare className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-4">"Solo escribe y funciona"</h3>
              <p className="text-gray-300 leading-relaxed">
                Conversación natural en tu idioma. Comandos de voz, imágenes, 
                y mensajes de texto. Todo funciona.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Products Section */}
      <section id="productos" className="py-24 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold gradient-text mb-6">
              Nuestros Productos
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Agentes de IA especializados para empresarios y familias latinoamericanas
            </p>
          </div>

          {/* agente.ceo */}
          <div className="mb-24">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
              >
                <div className="flex items-center space-x-4 mb-6">
                  <div className="w-20 h-20 rounded-xl flex items-center justify-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-blue-500"></div>
                    <Building2 className="w-10 h-10 text-white relative z-10" />
                  </div>
                  <div>
                    <h3 className="text-3xl font-bold text-white">agente.ceo</h3>
                    <p className="text-purple-400 text-lg">Sistema operativo para tu negocio</p>
                  </div>
                </div>

                <p className="text-gray-300 mb-8 text-lg leading-relaxed">
                  <span className="text-white font-semibold">Sistema operativo empresarial con IA para 40M+ micro-empresas latinoamericanas.</span>
                  <br />
                  Todo por WhatsApp: ventas, facturación electrónica, inventario, pagos automáticos y más.
                </p>

                <div className="grid md:grid-cols-2 gap-4 mb-8">
                  {agenteCeoFeatures.map((feature, index) => (
                    <div key={index} className="flex items-start space-x-3 p-3 glass-card rounded-lg">
                      <feature.icon className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-1" />
                      <div>
                        <div className="text-white font-medium text-sm">{feature.title}</div>
                        <div className="text-gray-400 text-xs">{feature.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-lg p-6 mb-8">
                  <div className="flex items-center space-x-2 mb-3">
                    <BarChart3 className="w-5 h-5 text-purple-400" />
                    <span className="text-purple-300 font-semibold">Características Técnicas</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="text-gray-300">
                      • <strong>38 AI Skills</strong> por dominio
                      <br />
                      • <strong>10 MCP Servers</strong> integrados
                      <br />
                      • <strong>4 países</strong> tax compliance
                    </div>
                    <div className="text-gray-300">
                      • <strong>vLLM/Qwen 27B</strong> self-hosted
                      <br />
                      • <strong>Whisper STT</strong> + Kokoro TTS
                      <br />
                      • <strong>Baileys</strong> WhatsApp gateway
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <a
                    href="https://biz.yaya.sh"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-gradient flex-1 justify-center"
                  >
                    Ir a biz.yaya.sh
                    <ArrowRight className="w-5 h-5" />
                  </a>
                </div>
              </motion.div>

              {/* WhatsApp Demo */}
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
                className="glass-card-strong p-6"
              >
                <div className="bg-green-600 text-white p-4 rounded-t-xl flex items-center space-x-3">
                  <MessageSquare className="w-6 h-6" />
                  <span className="font-semibold">agente.ceo</span>
                  <span className="text-green-200 text-sm">en línea</span>
                </div>
                
                <div className="bg-gray-900/50 p-4 space-y-4 max-h-96 overflow-y-auto">
                  {whatsappDemo1.map((msg, index) => (
                    <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-xs p-3 rounded-lg ${
                        msg.sender === 'user' 
                          ? 'bg-blue-500 text-white rounded-br-none' 
                          : 'bg-gray-700 text-white rounded-bl-none'
                      }`}>
                        <p className="text-sm whitespace-pre-line">{msg.message}</p>
                        <p className="text-xs opacity-60 mt-1">{msg.time}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-green-50 text-gray-800 p-3 rounded-b-xl text-center text-sm">
                  💬 Terminal de WhatsApp - Demo empresario preguntando por ventas
                </div>
              </motion.div>
            </div>
          </div>

          {/* agente.fit */}
          <div className="mb-16">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* WhatsApp Demo */}
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
                className="glass-card-strong p-6 order-2 lg:order-1"
              >
                <div className="bg-emerald-600 text-white p-4 rounded-t-xl flex items-center space-x-3">
                  <Heart className="w-6 h-6" />
                  <span className="font-semibold">agente.fit</span>
                  <span className="text-emerald-200 text-sm">en línea</span>
                </div>
                
                <div className="bg-gray-900/50 p-4 space-y-4 max-h-96 overflow-y-auto">
                  {whatsappDemo2.map((msg, index) => (
                    <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-xs p-3 rounded-lg ${
                        msg.sender === 'user' 
                          ? 'bg-blue-500 text-white rounded-br-none' 
                          : 'bg-gray-700 text-white rounded-bl-none'
                      }`}>
                        <p className="text-sm whitespace-pre-line">{msg.message}</p>
                        <p className="text-xs opacity-60 mt-1">{msg.time}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-emerald-50 text-gray-800 p-3 rounded-b-xl text-center text-sm">
                  💬 Terminal de WhatsApp - Demo madre preguntando por nutrición infantil
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
                className="order-1 lg:order-2"
              >
                <div className="flex items-center space-x-4 mb-6">
                  <div className="w-20 h-20 rounded-xl flex items-center justify-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-teal-500"></div>
                    <Heart className="w-10 h-10 text-white relative z-10" />
                  </div>
                  <div>
                    <h3 className="text-3xl font-bold text-white">agente.fit</h3>
                    <p className="text-emerald-400 text-lg">Tu compañera de salud</p>
                  </div>
                </div>

                <p className="text-gray-300 mb-8 text-lg leading-relaxed">
                  <span className="text-white font-semibold">Compañera de salud con IA para familias peruanas vía WhatsApp.</span>
                  <br />
                  Especializada en prevención de anemia infantil y seguimiento del crecimiento.
                </p>

                <div className="grid md:grid-cols-2 gap-4 mb-8">
                  {agenteFitFeatures.map((feature, index) => (
                    <div key={index} className="flex items-start space-x-3 p-3 glass-card rounded-lg">
                      <feature.icon className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-1" />
                      <div>
                        <div className="text-white font-medium text-sm">{feature.title}</div>
                        <div className="text-gray-400 text-xs">{feature.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-gradient-to-r from-emerald-500/20 to-teal-500/20 rounded-lg p-6 mb-8">
                  <div className="flex items-center space-x-2 mb-3">
                    <Target className="w-5 h-5 text-emerald-400" />
                    <span className="text-emerald-300 font-semibold">Impacto Comprobado</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <p className="text-emerald-200">
                      <strong>"Reducimos anemia del 65% al 12%"</strong> (modelo Iguaín)
                    </p>
                    <p className="text-gray-300">
                      Basado en el modelo Iguaín (Premio Sasakawa OMS 2019)
                    </p>
                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <div className="text-gray-300">
                        • <strong>15 personas</strong> especializadas
                        <br />
                        • <strong>Superfoods</strong> database peruana
                      </div>
                      <div className="text-gray-300">
                        • <strong>Spanish + Quechua</strong> nativo
                        <br />
                        • <strong>WHO z-scores</strong> integrados
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <a
                    href={`https://wa.me/${process.env.NEXT_PUBLIC_HEALTH_PHONE || '51999888777'}?text=${encodeURIComponent('Hola, quiero evaluar la salud de mi hijo')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-gradient flex-1 justify-center"
                  >
                    <MessageSquare className="w-5 h-5" />
                    Probar por WhatsApp
                    <ArrowRight className="w-5 h-5" />
                  </a>
                  <a
                    href="https://health.yaya.sh"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary flex-1 justify-center"
                  >
                    health.yaya.sh
                  </a>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Open Source Section */}
      <section className="py-24 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold gradient-text mb-6">
              100% Código Abierto
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Construido completamente sobre tecnologías abiertas. Transparencia total.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12 items-center mb-16">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
            >
              <h3 className="text-2xl font-bold text-white mb-6">@yaya/core - Biblioteca Compartida</h3>
              <p className="text-gray-300 mb-8 leading-relaxed">
                La base sobre la que ambas aplicaciones están construidas. 
                Servidores web, base de datos, colas de trabajo, criptografía, 
                enrutamiento de IA, y adaptadores de WhatsApp.
              </p>
              
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <Check className="w-5 h-5 text-green-400" />
                  <span className="text-gray-300">Servidores web y APIs</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Check className="w-5 h-5 text-green-400" />
                  <span className="text-gray-300">Gestión de bases de datos</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Check className="w-5 h-5 text-green-400" />
                  <span className="text-gray-300">Colas de trabajo y jobs</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Check className="w-5 h-5 text-green-400" />
                  <span className="text-gray-300">Criptografía y seguridad</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Check className="w-5 h-5 text-green-400" />
                  <span className="text-gray-300">AI routing y adaptadores WhatsApp</span>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              className="glass-card-strong p-8"
            >
              <h4 className="text-xl font-bold text-white mb-6">Stack Tecnológico</h4>
              <div className="grid grid-cols-3 gap-4">
                {techLogos.map((tech, index) => (
                  <div key={index} className="flex flex-col items-center p-4 glass-card rounded-lg text-center">
                    <tech.icon className="w-8 h-8 text-purple-400 mb-2" />
                    <span className="text-white text-sm font-medium">{tech.name}</span>
                  </div>
                ))}
              </div>
              <div className="mt-6 text-gray-300 text-sm space-y-2">
                <p>• <strong>vLLM/Qwen 27B:</strong> Modelo de IA local</p>
                <p>• <strong>Whisper STT:</strong> Reconocimiento de voz</p>
                <p>• <strong>Kokoro TTS:</strong> Síntesis de voz</p>
                <p>• <strong>Baileys:</strong> Gateway WhatsApp</p>
                <p>• <strong>Lago:</strong> Facturación y billing</p>
                <p>• <strong>Metabase:</strong> Analytics y reportes</p>
              </div>
            </motion.div>
          </div>

          <div className="text-center">
            <div className="glass-card-strong p-8 max-w-4xl mx-auto">
              <div className="grid md:grid-cols-3 gap-6 mb-8">
                <div className="text-center">
                  <ExternalLink className="w-12 h-12 text-white mx-auto mb-4" />
                  <h4 className="text-white font-semibold mb-2">yaya_platform</h4>
                  <p className="text-gray-400 text-sm">agente.ceo repository</p>
                  <a href="#" className="text-cyan-400 hover:text-cyan-300 text-sm">Ver en GitHub →</a>
                </div>
                <div className="text-center">
                  <ExternalLink className="w-12 h-12 text-white mx-auto mb-4" />
                  <h4 className="text-white font-semibold mb-2">yaya_health</h4>
                  <p className="text-gray-400 text-sm">agente.fit repository</p>
                  <a href="#" className="text-cyan-400 hover:text-cyan-300 text-sm">Ver en GitHub →</a>
                </div>
                <div className="text-center">
                  <ExternalLink className="w-12 h-12 text-white mx-auto mb-4" />
                  <h4 className="text-white font-semibold mb-2">yaya_core</h4>
                  <p className="text-gray-400 text-sm">@yaya/core library</p>
                  <a href="#" className="text-cyan-400 hover:text-cyan-300 text-sm">Ver en GitHub →</a>
                </div>
              </div>
              <p className="text-gray-300">
                Todos nuestros repositorios están disponibles bajo licencias de código abierto. 
                Construye, modifica, y distribuye libremente.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Impact Section */}
      <section id="impacto" className="py-24 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold gradient-text mb-6">
              Impacto Real
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Números que demuestran el potencial transformador de nuestros agentes de IA
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-8 mb-16">
            {impactStats.map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="glass-card p-8 text-center glow-hover smooth-transition"
              >
                <div className="text-4xl md:text-5xl font-bold gradient-text mb-4">
                  {stat.number}
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{stat.label}</h3>
                <p className="text-gray-400 text-sm">{stat.description}</p>
              </motion.div>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              className="glass-card-strong p-8"
            >
              <h3 className="text-2xl font-bold text-white mb-6 flex items-center space-x-3">
                <Building2 className="w-6 h-6 text-purple-400" />
                <span>Impacto Empresarial</span>
              </h3>
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                  <span className="text-gray-300">40M+ micro-empresas en LATAM necesitan herramientas accesibles</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full"></div>
                  <span className="text-gray-300">38 AI Skills cubren todo el ciclo empresarial</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
                  <span className="text-gray-300">Cumplimiento fiscal en 4 países (PE, CO, BR, MX)</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                  <span className="text-gray-300">Self-hosted, privacy-first para datos sensibles</span>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              className="glass-card-strong p-8"
            >
              <h3 className="text-2xl font-bold text-white mb-6 flex items-center space-x-3">
                <Heart className="w-6 h-6 text-emerald-400" />
                <span>Impacto en Salud</span>
              </h3>
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                  <span className="text-gray-300">43.7% de niños menores de 3 años con anemia en Perú</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
                  <span className="text-gray-300">Modelo Iguaín redujo anemia del 65% al 12%</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                  <span className="text-gray-300">WHO z-scores y superfoods database nativa</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                  <span className="text-gray-300">Español y quechua para comunidades diversas</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="precios" className="py-24 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold gradient-text mb-6">
              Precios Transparentes
            </h2>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Planes que se adaptan a tu realidad y crecen contigo
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                name: "Comunidad",
                price: "Gratis",
                period: "para siempre",
                description: "agente.fit para familias",
                features: [
                  "Acceso completo a agente.fit",
                  "Seguimiento de crecimiento infantil",
                  "Prevención de anemia",
                  "Recetas con superfoods peruanos",
                  "Soporte en español y quechua",
                  "Consejos de salud materna",
                  "Base de datos WHO z-scores"
                ],
                popular: false,
                link: `https://wa.me/${process.env.NEXT_PUBLIC_HEALTH_PHONE || '51999888777'}?text=${encodeURIComponent('Hola, quiero evaluar la salud de mi hijo')}`
              },
              {
                name: "Negocio",
                price: "$29",
                period: "por mes",
                description: "agente.ceo para empresarios",
                features: [
                  "Acceso completo a agente.ceo",
                  "38 AI Skills empresariales",
                  "Facturación electrónica SUNAT/DIAN/SAT",
                  "Gestión de inventario y CRM",
                  "Integración Yape, Plin, bancos",
                  "Reportes y analytics avanzados",
                  "10 MCP servers integrados",
                  "Soporte prioritario"
                ],
                popular: true,
                link: "https://biz.yaya.sh"
              },
              {
                name: "Empresa",
                price: "$99",
                period: "por mes",
                description: "Multi-tenant, soporte prioritario",
                features: [
                  "Todo en Negocio",
                  "Multi-tenant SaaS",
                  "Colaboración en equipos",
                  "Seguridad empresarial",
                  "API personalizada",
                  "Entrenamiento de IA custom",
                  "SLA garantizado",
                  "Soporte dedicado 24/7"
                ],
                popular: false,
                link: "#"
              }
            ].map((plan, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className={`pricing-card glass-card-strong p-8 relative glow-hover smooth-transition ${
                  plan.popular ? 'ring-2 ring-purple-500' : ''
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="premium-badge">Más Popular</span>
                  </div>
                )}

                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                  <div className="mb-4">
                    <span className="text-4xl font-bold gradient-text">{plan.price}</span>
                    {plan.price !== "Gratis" && <span className="text-gray-400 ml-2">{plan.period}</span>}
                  </div>
                  <p className="text-gray-300">{plan.description}</p>
                </div>

                <div className="space-y-4 mb-8">
                  {plan.features.map((feature, featureIndex) => (
                    <div key={featureIndex} className="flex items-start space-x-3">
                      <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-300 text-sm">{feature}</span>
                    </div>
                  ))}
                </div>

                <a 
                  href={plan.link}
                  target={plan.link.startsWith('http') ? '_blank' : undefined}
                  rel={plan.link.startsWith('http') ? 'noopener noreferrer' : undefined}
                  className={`w-full ${plan.popular ? 'btn-gradient' : 'btn-secondary'}`}
                >
                  {plan.name === "Comunidad" ? "Usar Gratis" : plan.name === "Empresa" ? "Contactar" : "Empezar Ahora"}
                  <ArrowRight className="w-4 h-4" />
                </a>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="glass-card-strong p-12 pulse-glow"
          >
            <h2 className="text-4xl md:text-5xl font-bold gradient-text mb-6">
              ¿Listo para Transformar?
            </h2>
            <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
              Únete a la revolución de la IA en América Latina. 
              Todo por WhatsApp, en tu idioma, respetando tu privacidad.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
              <a href="https://biz.yaya.sh" target="_blank" rel="noopener noreferrer" className="btn-cta">
                <Building2 className="w-5 h-5" />
                Para tu negocio
                <ArrowRight className="w-5 h-5" />
              </a>
              <a
                href={`https://wa.me/${process.env.NEXT_PUBLIC_HEALTH_PHONE || '51999888777'}?text=${encodeURIComponent('Hola, quiero evaluar la salud de mi hijo')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-gradient"
              >
                <Heart className="w-5 h-5" />
                Prueba Agente Fit gratis
                <ArrowRight className="w-5 h-5" />
              </a>
            </div>

            <p className="text-sm text-gray-400">
              100% código abierto • Privacy-first • Solo por WhatsApp
            </p>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-cyan-500"></div>
                  <Brain className="w-5 h-5 text-white relative z-10" />
                </div>
                <span className="text-xl font-bold gradient-text">Agente</span>
              </div>
              <p className="text-gray-400">
                Agentes de IA para Latinoamérica. Privacy-first, open source, built on WhatsApp.
              </p>
              <p className="text-gray-500 text-sm">
                Hecho con ❤️ para comunidades que merecen mejor tecnología
                <br />
                Built with ❤️ for communities that deserve better technology
              </p>
            </div>

            <div>
              <h4 className="text-white font-semibold mb-4">Productos</h4>
              <div className="space-y-2">
                <a href="https://biz.yaya.sh" target="_blank" rel="noopener noreferrer" className="block text-gray-400 hover:text-white smooth-transition">
                  agente.ceo - biz.yaya.sh
                </a>
                <a href="https://health.yaya.sh" target="_blank" rel="noopener noreferrer" className="block text-gray-400 hover:text-white smooth-transition">
                  agente.fit - health.yaya.sh
                </a>
              </div>
            </div>

            <div>
              <h4 className="text-white font-semibold mb-4">Open Source</h4>
              <div className="space-y-2">
                <a href="#" className="block text-gray-400 hover:text-white smooth-transition flex items-center space-x-2">
                  <ExternalLink className="w-4 h-4" />
                  <span>yaya_platform</span>
                </a>
                <a href="#" className="block text-gray-400 hover:text-white smooth-transition flex items-center space-x-2">
                  <ExternalLink className="w-4 h-4" />
                  <span>yaya_health</span>
                </a>
                <a href="#" className="block text-gray-400 hover:text-white smooth-transition flex items-center space-x-2">
                  <ExternalLink className="w-4 h-4" />
                  <span>yaya_core</span>
                </a>
                <a href="#" className="block text-gray-400 hover:text-white smooth-transition">
                  Documentación
                </a>
              </div>
            </div>

            <div>
              <h4 className="text-white font-semibold mb-4">Soporte</h4>
              <div className="space-y-2">
                <a href="#" className="block text-gray-400 hover:text-white smooth-transition">Documentación</a>
                <a href="#" className="block text-gray-400 hover:text-white smooth-transition">API Reference</a>
                <a href="#" className="block text-gray-400 hover:text-white smooth-transition">Comunidad</a>
                <a href="#" className="block text-gray-400 hover:text-white smooth-transition">Contacto</a>
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 mt-12 pt-8 text-center">
            <p className="text-gray-400">
              © 2024 Agente. Todos los derechos reservados. • Privacy-first AI agents for Latin America.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}