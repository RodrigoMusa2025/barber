import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, Users, Settings, TrendingUp, Plus, Minus, Scissors, 
  DollarSign, Trash2, Save, Wallet, Receipt, ArrowDownCircle, Tag, X, 
  Package, Calendar as CalendarIcon, Search, Phone, MessageCircle, 
  AlertCircle, Power, Loader2
} from 'lucide-react';

// --- IMPORTACIONES DE FIREBASE ---
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy 
} from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';

// --- CONFIGURACIÓN E INICIALIZACIÓN DE FIREBASE ---

let firebaseConfig;

// 1. Entorno de PREVISUALIZACIÓN (Chat):
// Detecta si estamos corriendo en el editor del chat para usar la config automática.
if (typeof __firebase_config !== 'undefined') {
  firebaseConfig = JSON.parse(__firebase_config);
} else {
  // 2. Entorno de PRODUCCIÓN (Vercel) - PROYECTO: evolution-gym-ok
  // Tus credenciales reales se usarán solo cuando despliegues la app fuera de aquí.
  firebaseConfig = {
    apiKey: "AIzaSyBBywAzjBsU5nQFayKPdTMO6bcQtQeKK8E",
    authDomain: "evolution-gym-ok.firebaseapp.com",
    projectId: "evolution-gym-ok",
    storageBucket: "evolution-gym-ok.firebasestorage.app",
    messagingSenderId: "779965799604",
    appId: "1:779965799604:web:5df6b90fe29e233dd44be1",
    measurementId: "G-PWPKX83H9Q"
  };
}

// Inicializamos la app
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- CORRECCIÓN CRÍTICA AQUÍ ---
// Usamos el ID dinámico (__app_id) si estamos en el chat para evitar errores de permisos.
// Si estamos en Vercel (donde __app_id no existe), usamos 'evolution-gym-ok'.
const appId = typeof __app_id !== 'undefined' ? __app_id : 'evolution-gym-ok'; 

// --- COMPONENTES UI ---
const Card = ({ children, className }) => (
  <div className={`bg-white border border-slate-200 rounded-2xl shadow-sm ${className}`}>
    {children}
  </div>
);

const StatBox = ({ label, value, icon: Icon, color, subtext }) => (
  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between relative overflow-hidden">
    <div className="relative z-10">
      <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">{label}</p>
      <h3 className="text-3xl font-black text-slate-800">{value}</h3>
      {subtext && <p className="text-xs text-slate-500 mt-1">{subtext}</p>}
    </div>
    <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center text-white shadow-md`}>
      <Icon size={24} />
    </div>
  </div>
);

export default function MiBarberiaPanel() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('dashboard');
  const [loading, setLoading] = useState(true);

  // --- ESTADO DE DATOS (Desde Firebase) ---
  const [services, setServices] = useState([]);
  const [products, setProducts] = useState([]);
  const [barbers, setBarbers] = useState([]);
  const [clients, setClients] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [transactions, setTransactions] = useState([]);

  // --- MANEJO DE FECHAS ---
  const todayStr = new Date().toISOString().split('T')[0];
  const [dateRange, setDateRange] = useState({ start: todayStr, end: todayStr });

  // --- ESTADOS UI ---
  const [showClientModal, setShowClientModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(null);
  const [addTab, setAddTab] = useState('services');
  const [clientSearch, setClientSearch] = useState('');

  // Formularios
  const [newClient, setNewClient] = useState({ name: '', lastName: '', phone: '', notes: '' });
  const [newExpense, setNewExpense] = useState({ desc: '', amount: '', barberId: 'shop' });
  const [newBarber, setNewBarber] = useState({ name: '', lastName: '', commission: 50 });
  const [newService, setNewService] = useState({ name: '', price: '' });

  // --- 1. AUTENTICACIÓN ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Error de autenticación:", error);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  // --- 2. SINCRONIZACIÓN DE DATOS ---
  useEffect(() => {
    if (!user) return;

    // Usamos una ruta simple: /artifacts/{projectId}/public/data/{collection}
    const getColl = (name) => collection(db, 'artifacts', appId, 'public', 'data', name);

    // Función auxiliar para manejar snapshots y errores
    const handleSnapshot = (setter) => (snap) => {
      setter(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    const handleError = (err) => console.error("Error en listener:", err);

    const unsubServices = onSnapshot(getColl('services'), handleSnapshot(setServices), handleError);
    const unsubProducts = onSnapshot(getColl('products'), handleSnapshot(setProducts), handleError);
    const unsubBarbers = onSnapshot(getColl('barbers'), handleSnapshot(setBarbers), handleError);
    const unsubClients = onSnapshot(getColl('clients'), handleSnapshot(setClients), handleError);
    const unsubExpenses = onSnapshot(getColl('expenses'), handleSnapshot(setExpenses), handleError);
    const unsubTrans = onSnapshot(getColl('transactions'), (snap) => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, handleError);

    return () => {
      unsubServices(); unsubProducts(); unsubBarbers(); unsubClients(); unsubExpenses(); unsubTrans();
    };
  }, [user]);

  // --- 3. HANDLERS ---

  // Agregar Transacción
  const handleAdd = async (barberId, item, type) => {
    if (type === 'product') {
      if (item.stock <= 0) { alert("¡Sin stock!"); return; }
      const prodRef = doc(db, 'artifacts', appId, 'public', 'data', 'products', item.id);
      await updateDoc(prodRef, { stock: item.stock - 1 });
    }
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'), {
      barberId, type, itemId: item.id, price: item.price, date: todayStr, timestamp: Date.now()
    });
    setShowAddModal(null);
  };

  // Agregar Gasto
  const handleAddExpense = async () => {
    if (!newExpense.desc || !newExpense.amount) return;
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'expenses'), {
      desc: newExpense.desc, amount: parseFloat(newExpense.amount), barberId: newExpense.barberId === 'shop' ? null : newExpense.barberId, date: todayStr, timestamp: Date.now()
    });
    setNewExpense({ desc: '', amount: '', barberId: 'shop' });
    setShowExpenseModal(false);
  };

  // Agregar Cliente
  const handleAddClient = async () => {
    if (!newClient.name || !newClient.phone) return;
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'clients'), {
      name: newClient.name, lastName: newClient.lastName, phone: newClient.phone, notes: newClient.notes, visits: 0, totalSpent: 0, createdAt: Date.now()
    });
    setNewClient({ name: '', lastName: '', phone: '', notes: '' });
    setShowClientModal(false);
  };

  // Configuración: Barberos
  const handleAddBarber = async () => {
    if (!newBarber.name || !newBarber.lastName) return;
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'barbers'), {
      name: newBarber.name, lastName: newBarber.lastName, active: true, commission: parseInt(newBarber.commission) || 50
    });
    setNewBarber({ name: '', lastName: '', commission: 50 });
  };

  const toggleBarberActive = async (barber) => {
    const barberRef = doc(db, 'artifacts', appId, 'public', 'data', 'barbers', barber.id);
    await updateDoc(barberRef, { active: !barber.active });
  };

  // Configuración: Servicios
  const handleAddService = async () => {
    if (!newService.name || !newService.price) return;
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'services'), {
      name: newService.name, price: parseInt(newService.price), type: 'service'
    });
    setNewService({ name: '', price: '' });
  };

  const handleDeleteService = async (id) => {
    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'services', id));
  };

  // Sembrar datos iniciales (Seed)
  const seedData = async () => {
    setLoading(true);
    // Creamos los datos uno por uno para asegurar que se guarden
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'barbers'), { name: 'Lucas', lastName: 'Perez', active: true, commission: 60 });
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'barbers'), { name: 'Kevin', lastName: 'Diaz', active: true, commission: 50 });
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'services'), { name: 'Corte Clásico', price: 8000, type: 'service' });
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'services'), { name: 'Barba', price: 4000, type: 'service' });
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'products'), { name: 'Cera Mate', price: 5000, stock: 10, cost: 2500, commission: 10 });
    setLoading(false);
  };

  // --- LÓGICA DE CÁLCULO ---
  const calculateStats = (startDate, endDate) => {
    const currentTx = transactions.filter(t => t.date >= startDate && t.date <= endDate);
    const currentExpenses = expenses.filter(e => e.date >= startDate && e.date <= endDate);
    
    const shopExpensesTotal = currentExpenses.filter(e => e.barberId === null).reduce((acc, curr) => acc + curr.amount, 0);
    const totalRevenue = currentTx.reduce((acc, curr) => acc + curr.price, 0);
    let totalCommissionsToPay = 0; 
    
    const barberStats = barbers.map(barber => {
      const myTx = currentTx.filter(t => t.barberId === barber.id);
      const myPersonalExpenses = currentExpenses.filter(e => e.barberId === barber.id);
      let myGrossPay = 0, myRevenue = 0;
      const breakdown = {};

      myTx.forEach(tx => {
        myRevenue += tx.price;
        if (tx.type === 'service') {
          myGrossPay += tx.price * (barber.commission / 100);
          const sName = services.find(s => s.id === tx.itemId)?.name || 'Servicio';
          breakdown[sName] = (breakdown[sName] || 0) + 1;
        } else if (tx.type === 'product') {
          const prod = products.find(p => p.id === tx.itemId);
          const comm = prod ? prod.commission : 10; 
          myGrossPay += tx.price * (comm / 100);
          const pName = prod?.name || 'Producto';
          breakdown[pName] = (breakdown[pName] || 0) + 1;
        }
      });

      const totalDeductions = myPersonalExpenses.reduce((acc, curr) => acc + curr.amount, 0);
      totalCommissionsToPay += myGrossPay; 

      return {
        ...barber, jobsCount: myTx.length, revenue: myRevenue, grossPay: myGrossPay,
        deductions: totalDeductions, netPay: myGrossPay - totalDeductions,
        personalExpensesList: myPersonalExpenses, breakdown 
      };
    });

    const netShopProfit = totalRevenue - totalCommissionsToPay - shopExpensesTotal;
    return { totalRevenue, shopExpensesTotal, totalCommissionsToPay, netShopProfit, barberStats };
  };

  const stats = calculateStats(dateRange.start, dateRange.end);
  const activeBarbers = barbers.filter(b => b.active);

  const setQuickDate = (type) => {
    const today = new Date();
    const start = new Date(today);
    if (type === 'today') {
      setDateRange({ start: todayStr, end: todayStr });
    } else if (type === 'week') {
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1); 
      start.setDate(diff);
      setDateRange({ start: start.toISOString().split('T')[0], end: todayStr });
    } else if (type === 'month') {
      start.setDate(1);
      setDateRange({ start: start.toISOString().split('T')[0], end: todayStr });
    }
  };

  // --- UI: LOADING ---
  if (loading && !barbers.length && !services.length) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 text-slate-400 gap-4">
        <Loader2 className="animate-spin" size={40} />
        <p className="text-sm font-bold">Cargando Barbería...</p>
        <button onClick={seedData} className="text-xs underline hover:text-slate-600">
          (Si es la primera vez, haz click para cargar datos de prueba)
        </button>
      </div>
    );
  }

  // --- UI: SIDEBAR ---
  const Sidebar = () => (
    <aside className="bg-slate-900 text-white w-full md:w-64 flex-shrink-0 p-6 md:h-screen md:sticky md:top-0 z-20 flex flex-col">
      <div className="flex items-center gap-3 mb-10">
        <div className="w-10 h-10 bg-yellow-500 rounded-xl flex items-center justify-center text-black font-bold text-xl shadow-lg shadow-yellow-500/20"><Scissors /></div>
        <div><h1 className="font-black text-lg italic uppercase">Mi Barbería</h1><p className="text-xs text-slate-400 mt-1">Panel Master</p></div>
      </div>
      <nav className="space-y-2 flex-1">
        <button onClick={() => setView('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition font-bold ${view === 'dashboard' ? 'bg-yellow-500 text-black' : 'hover:bg-slate-800 text-slate-400'}`}><LayoutDashboard size={20} /> Tablero</button>
        <button onClick={() => setView('payroll')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition font-bold ${view === 'payroll' ? 'bg-green-600 text-white' : 'hover:bg-slate-800 text-green-400'}`}><Wallet size={20} /> Liquidaciones</button>
        <button onClick={() => setView('clients')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition font-bold ${view === 'clients' ? 'bg-slate-800 text-white' : 'hover:bg-slate-800 text-slate-400'}`}><Users size={20} /> Clientes</button>
        <button onClick={() => setView('inventory')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition font-bold ${view === 'inventory' ? 'bg-slate-800 text-white' : 'hover:bg-slate-800 text-slate-400'}`}><Package size={20} /> Inventario</button>
        <button onClick={() => setView('settings')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition font-bold ${view === 'settings' ? 'bg-slate-800 text-white' : 'hover:bg-slate-800 text-slate-400'}`}><Settings size={20} /> Configuración</button>
      </nav>
      <div className="mt-auto pt-6 border-t border-slate-800 flex items-center gap-2">
           <div className={`w-2 h-2 rounded-full ${user ? 'bg-green-500' : 'bg-red-500'}`}></div>
           <p className="text-xs text-slate-500">Estado: {user ? 'En línea' : 'Desconectado'}</p>
      </div>
    </aside>
  );

  // --- VISTAS ---

  if (view === 'dashboard') {
    return (
      <div className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col md:flex-row">
        <Sidebar />
        <main className="flex-1 p-6 md:p-8 overflow-y-auto">
          <div className="flex flex-wrap justify-between items-end gap-4 mb-8 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
             <div>
               <h2 className="text-xl font-bold text-slate-800">Tablero de Control</h2>
               <p className="text-slate-500 text-xs">Resumen del periodo seleccionado</p>
             </div>
             <div className="flex items-center gap-2">
                <div className="flex bg-slate-100 p-1 rounded-lg">
                   <button onClick={() => setQuickDate('today')} className="px-3 py-1.5 text-xs font-bold rounded-md hover:bg-white transition">Hoy</button>
                   <button onClick={() => setQuickDate('week')} className="px-3 py-1.5 text-xs font-bold rounded-md hover:bg-white transition">Semana</button>
                   <button onClick={() => setQuickDate('month')} className="px-3 py-1.5 text-xs font-bold rounded-md hover:bg-white transition">Mes</button>
                </div>
                <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                   <CalendarIcon size={14} className="text-slate-500"/>
                   <input type="date" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} className="bg-transparent text-xs font-bold outline-none w-24"/>
                   <span className="text-slate-400">-</span>
                   <input type="date" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} className="bg-transparent text-xs font-bold outline-none w-24"/>
                </div>
                <button onClick={() => setShowExpenseModal(true)} className="bg-red-500 text-white px-4 py-2 rounded-lg font-bold text-xs hover:bg-red-600 flex items-center gap-2 shadow-lg shadow-red-200 transition ml-2">
                   <ArrowDownCircle size={14} /> Nuevo Gasto
                </button>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10">
             <StatBox label="Facturación Total" value={`$${stats.totalRevenue.toLocaleString()}`} icon={DollarSign} color="bg-blue-600" subtext="Caja Bruta" />
             <StatBox label="Gastos Local" value={`-$${stats.shopExpensesTotal.toLocaleString()}`} icon={Receipt} color="bg-red-500" subtext="Luz, Alquiler, Insumos" />
             <StatBox label="Ganancia Neta" value={`$${stats.netShopProfit.toLocaleString()}`} icon={TrendingUp} color="bg-green-600" subtext="Limpio para el dueño" />
             <StatBox label="Trabajos Totales" value={stats.barberStats.reduce((acc, b) => acc + b.jobsCount, 0)} icon={Scissors} color="bg-slate-800" subtext="Cortes realizados" />
          </div>

          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">Actividad del Equipo</h3>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {activeBarbers.map((barber) => {
              const bStats = stats.barberStats.find(s => s.id === barber.id) || { jobsCount: 0, revenue: 0, breakdown: {} };
              return (
                <Card key={barber.id} className="overflow-hidden hover:border-yellow-400 transition-all duration-300 group relative">
                  <div className="bg-slate-50 p-4 border-b border-slate-100 flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center font-bold text-white text-sm border-2 border-white shadow-sm">
                        {barber.name[0]}{barber.lastName[0]}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800">{barber.name}</h4>
                        <span className="text-[10px] text-slate-500 font-medium">
                          Facturó: <span className="text-green-600 font-bold">${bStats.revenue.toLocaleString()}</span>
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="bg-slate-200 text-slate-600 text-[10px] font-bold px-2 py-1 rounded">
                         {bStats.jobsCount} Trabajos
                      </span>
                    </div>
                  </div>
                  <div className="p-4 flex gap-2 flex-wrap min-h-[80px] content-start">
                      {Object.entries(bStats.breakdown || {}).map(([name, qty]) => (
                        <span key={name} className="text-[10px] bg-white border border-slate-200 text-slate-600 px-2 py-1 rounded shadow-sm">
                            {qty} x {name}
                        </span>
                      ))}
                      {bStats.jobsCount === 0 && <span className="text-xs text-slate-300 italic w-full text-center py-4">Sin actividad en este periodo</span>}
                  </div>
                  <div className="p-4 pt-0">
                      <button onClick={() => setShowAddModal(barber.id)} className="w-full bg-yellow-500 text-black font-bold rounded-xl py-3 shadow-lg hover:bg-yellow-400 transition flex items-center justify-center gap-2">
                        <Plus size={20} /> Registrar Trabajo
                      </button>
                  </div>
                </Card>
              );
            })}
            {activeBarbers.length === 0 && (
              <div className="col-span-full p-10 text-center border-2 border-dashed border-slate-300 rounded-2xl">
                <p className="text-slate-400 mb-2">No hay barberos activos.</p>
                <button onClick={() => setView('settings')} className="text-blue-600 font-bold text-sm underline">Ir a Configuración para agregar personal</button>
              </div>
            )}
          </div>

          {showExpenseModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
              <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in duration-200">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold">Registrar Salida</h3>
                    <button onClick={() => setShowExpenseModal(false)}><X size={20} className="text-slate-400"/></button>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">¿Quién paga?</label>
                      <select className="w-full p-3 border border-slate-200 rounded-xl font-bold outline-none bg-slate-50" value={newExpense.barberId} onChange={e => setNewExpense({...newExpense, barberId: e.target.value})}>
                        <option value="shop">🏠 La Barbería (Gasto General)</option>
                        {activeBarbers.map(b => (<option key={b.id} value={b.id}>👤 {b.name} (Adelanto/Consumo)</option>))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase">Concepto</label>
                      <input autoFocus type="text" className="w-full p-3 border rounded-xl font-bold outline-none focus:border-yellow-500" placeholder="Ej: Alfajor, Cera, Luz" value={newExpense.desc} onChange={e => setNewExpense({...newExpense, desc: e.target.value})} />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase">Monto ($)</label>
                      <input type="number" className="w-full p-3 border rounded-xl font-bold outline-none focus:border-yellow-500 text-red-600" placeholder="0" value={newExpense.amount} onChange={e => setNewExpense({...newExpense, amount: e.target.value})} />
                    </div>
                    <button onClick={handleAddExpense} className="w-full py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 shadow-lg shadow-red-200 mt-2">Confirmar Gasto</button>
                  </div>
              </div>
            </div>
          )}

          {showAddModal && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
                  <div className="bg-slate-50 p-4 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-bold text-lg text-slate-800">Registrar Movimiento</h3>
                    <button onClick={() => setShowAddModal(null)} className="p-2 bg-white rounded-full hover:bg-slate-200"><X size={20}/></button>
                  </div>
                  <div className="flex p-2 bg-slate-100 m-4 rounded-xl">
                    <button onClick={() => setAddTab('services')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${addTab === 'services' ? 'bg-white text-black shadow-sm' : 'text-slate-400'}`}>Servicios</button>
                    <button onClick={() => setAddTab('products')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${addTab === 'products' ? 'bg-white text-black shadow-sm' : 'text-slate-400'}`}>Productos</button>
                  </div>
                  <div className="p-6 pt-0 grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto">
                    {addTab === 'services' ? services.map(s => (
                      <button key={s.id} onClick={() => handleAdd(showAddModal, s, 'service')} className="bg-white border-2 border-slate-100 p-4 rounded-xl hover:border-yellow-500 hover:bg-yellow-50 transition text-left group">
                        <p className="font-bold text-slate-700 group-hover:text-black">{s.name}</p>
                        <p className="text-sm text-slate-400 font-medium">${s.price.toLocaleString()}</p>
                      </button>
                    )) : products.map(p => (
                      <button key={p.id} onClick={() => handleAdd(showAddModal, p, 'product')} disabled={p.stock <= 0} className={`border-2 p-4 rounded-xl text-left group transition relative ${p.stock > 0 ? 'bg-white border-slate-100 hover:border-blue-500 hover:bg-blue-50' : 'bg-slate-50 border-slate-100 opacity-60 cursor-not-allowed'}`}>
                        <p className="font-bold text-slate-700 group-hover:text-blue-900">{p.name}</p>
                        <p className="text-sm text-slate-400 font-medium">${p.price.toLocaleString()}</p>
                        <p className={`text-[10px] font-bold mt-1 ${p.stock < 3 ? 'text-red-500' : 'text-green-600'}`}>Stock: {p.stock}</p>
                      </button>
                    ))}
                    {addTab === 'services' && services.length === 0 && <p className="col-span-2 text-center text-slate-400 text-sm py-4">No hay servicios configurados.</p>}
                    {addTab === 'products' && products.length === 0 && <p className="col-span-2 text-center text-slate-400 text-sm py-4">No hay productos configurados.</p>}
                  </div>
              </div>
            </div>
          )}
        </main>
      </div>
    );
  }

  if (view === 'payroll') {
    return (
      <div className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col md:flex-row">
         <Sidebar />
         <main className="flex-1 p-8 overflow-y-auto">
            <div className="max-w-5xl mx-auto">
               <div className="mb-8">
                 <div className="flex justify-between items-end mb-6">
                   <div>
                     <h2 className="text-3xl font-black text-slate-800">Liquidación de Haberes</h2>
                     <p className="text-slate-500">Calculadora final de pagos para barberos.</p>
                   </div>
                   <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
                      <span className="text-xs font-bold uppercase text-slate-400 pl-2">Periodo:</span>
                      <input type="date" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm font-bold outline-none"/>
                      <span className="text-slate-300">→</span>
                      <input type="date" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm font-bold outline-none"/>
                   </div>
                 </div>
                 <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                    <table className="w-full text-left">
                       <thead className="bg-slate-900 text-white text-xs font-bold uppercase">
                          <tr>
                             <th className="p-4">Barbero</th>
                             <th className="p-4 text-right">Total Generado</th>
                             <th className="p-4 text-center">Comisión</th>
                             <th className="p-4 text-right">Sueldo Bruto</th>
                             <th className="p-4 text-right text-red-300">Descuentos</th>
                             <th className="p-4 text-right bg-green-900 text-green-300">A Pagar</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100 text-sm">
                          {stats.barberStats.map(b => (
                             <tr key={b.id} className={`hover:bg-slate-50 ${!b.active ? 'opacity-50 grayscale' : ''}`}>
                                <td className="p-4 font-bold text-slate-800 flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs">{b.name[0]}</div>
                                  <div>{b.name} {b.lastName}{!b.active && <span className="text-[10px] bg-slate-200 text-slate-500 px-1 ml-2 rounded">INACTIVO</span>}</div>
                                </td>
                                <td className="p-4 text-right font-medium">${b.revenue.toLocaleString()}</td>
                                <td className="p-4 text-center"><span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-bold">{b.commission}%</span></td>
                                <td className="p-4 text-right font-bold text-slate-700">${b.grossPay.toLocaleString()}</td>
                                <td className="p-4 text-right text-red-500 font-medium group relative cursor-help">
                                   <span className="border-b border-dotted border-red-300">-${b.deductions.toLocaleString()}</span>
                                   {b.deductions > 0 && (
                                     <div className="absolute right-0 top-full mt-1 w-56 bg-slate-800 text-white text-xs p-3 rounded-lg shadow-xl z-50 hidden group-hover:block text-left">
                                        <p className="font-bold mb-2 border-b border-slate-600 pb-1 text-slate-300">Detalle de Gastos:</p>
                                        {b.personalExpensesList.length > 0 ? b.personalExpensesList.map(exp => (
                                            <div key={exp.id} className="flex justify-between mb-1">
                                                <span>{exp.desc}</span>
                                                <span className="text-red-300">-${exp.amount}</span>
                                            </div>
                                        )) : <span className="text-slate-500 italic">Sin gastos</span>}
                                     </div>
                                   )}
                                </td>
                                <td className="p-4 text-right bg-green-50 font-black text-green-700 border-l border-green-100 text-lg">${b.netPay.toLocaleString()}</td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
               </div>
            </div>
         </main>
      </div>
    );
  }

  if (view === 'clients') {
    const filteredClients = clients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase()) || c.lastName.toLowerCase().includes(clientSearch.toLowerCase()));
    return (
      <div className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col md:flex-row">
        <Sidebar />
        <div className="flex-1 p-8 overflow-y-auto">
           <div className="max-w-5xl w-full mx-auto">
              <div className="flex items-center justify-between gap-4 mb-6">
                 <h2 className="text-2xl font-bold text-slate-800">Cartera de Clientes</h2>
                 <button onClick={() => setShowClientModal(true)} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-slate-800 flex items-center gap-2 shadow-lg"><Plus size={18} /> Nuevo Cliente</button>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl flex items-center px-4 shadow-sm mb-6">
                <Search className="text-slate-400" size={20} />
                <input type="text" placeholder="Buscar por nombre o apellido..." className="flex-1 p-4 outline-none text-sm font-medium" value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {filteredClients.map(client => (
                   <Card key={client.id} className="p-6 hover:border-yellow-500 transition group relative overflow-hidden">
                      <div className="flex justify-between items-start mb-4">
                         <div className="flex items-center gap-3">
                           <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-600 border border-slate-200">{client.name.charAt(0)}{client.lastName.charAt(0)}</div>
                           <div>
                              <h3 className="font-bold text-lg text-slate-800">{client.name} {client.lastName}</h3>
                              <div className="flex gap-3 text-xs text-slate-500 mt-1"><span className="flex items-center gap-1"><Phone size={12}/> {client.phone}</span></div>
                           </div>
                         </div>
                         <a href={`https://wa.me/${client.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="bg-green-500 text-white p-2 rounded-full shadow-md hover:bg-green-600 transition flex items-center justify-center" title="Enviar WhatsApp"><MessageCircle size={20} /></a>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs mb-4">
                         <p className="font-bold text-slate-500 uppercase mb-1">Notas Técnicas:</p>
                         <p className="text-slate-700 italic">"{client.notes}"</p>
                      </div>
                   </Card>
                 ))}
              </div>
           </div>
           {showClientModal && (
             <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-in fade-in">
                <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
                   <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold text-slate-800">Nuevo Cliente</h3><button onClick={() => setShowClientModal(false)}><X size={20} className="text-slate-400"/></button></div>
                   <div className="space-y-4">
                     <div className="grid grid-cols-2 gap-4">
                       <input type="text" className="w-full p-3 border rounded-xl font-bold outline-none" placeholder="Juan" value={newClient.name} onChange={e => setNewClient({...newClient, name: e.target.value})} />
                       <input type="text" className="w-full p-3 border rounded-xl font-bold outline-none" placeholder="Perez" value={newClient.lastName} onChange={e => setNewClient({...newClient, lastName: e.target.value})} />
                     </div>
                     <input type="tel" className="w-full p-3 border rounded-xl font-bold outline-none" placeholder="Whatsapp (549...)" value={newClient.phone} onChange={e => setNewClient({...newClient, phone: e.target.value})} />
                     <textarea className="w-full p-3 border rounded-xl outline-none h-24 resize-none text-sm" placeholder="Notas del corte..." value={newClient.notes} onChange={e => setNewClient({...newClient, notes: e.target.value})} />
                     <button onClick={handleAddClient} className="w-full py-3 bg-yellow-500 text-black font-bold rounded-xl">Guardar Cliente</button>
                   </div>
                </div>
             </div>
           )}
        </div>
      </div>
    );
  }

  if (view === 'inventory') {
    return (
      <div className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col md:flex-row">
        <Sidebar />
        <main className="flex-1 p-8 overflow-y-auto">
           <h2 className="text-2xl font-bold text-slate-800 mb-6">Control de Stock</h2>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
             {products.map(prod => (
               <Card key={prod.id} className="p-6 flex flex-col justify-between">
                 <div>
                   <div className="flex justify-between items-start mb-2">
                     <h3 className="font-bold text-lg">{prod.name}</h3>
                     <span className={`px-2 py-1 rounded text-xs font-bold ${prod.stock < 5 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{prod.stock} u.</span>
                   </div>
                   <p className="text-slate-500 text-sm">Precio Venta: ${prod.price}</p>
                   <p className="text-slate-400 text-xs">Costo: ${prod.cost}</p>
                 </div>
                 <div className="mt-4 pt-4 border-t border-slate-100 flex gap-2">
                    <button className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 rounded-lg text-xs opacity-50 cursor-not-allowed">Ajustar</button>
                 </div>
               </Card>
             ))}
             <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 flex flex-col items-center justify-center text-slate-400"><p className="text-sm">Gestión de productos completa en desarrollo</p></div>
           </div>
        </main>
      </div>
    );
  }

  // 5. SETTINGS
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col md:flex-row">
       <Sidebar />
       <main className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-5xl mx-auto">
             <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><Settings className="text-slate-400"/> Configuración del Local</h2>
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <section>
                   <div className="flex items-center justify-between mb-4"><h3 className="font-bold text-lg text-slate-700">Gestión de Equipo</h3><span className="text-xs bg-slate-200 px-2 py-1 rounded text-slate-600">{barbers.length} Barberos</span></div>
                   <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden mb-6">
                      {barbers.map(barber => (
                        <div key={barber.id} className="p-4 border-b border-slate-100 last:border-0 flex items-center justify-between">
                           <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white ${barber.active ? 'bg-slate-800' : 'bg-slate-300'}`}>{barber.name[0]}</div>
                              <div><p className={`font-bold ${barber.active ? 'text-slate-800' : 'text-slate-400'}`}>{barber.name} {barber.lastName}</p><p className="text-xs text-slate-500">Comisión: {barber.commission}%</p></div>
                           </div>
                           <button onClick={() => toggleBarberActive(barber)} className={`p-2 rounded-lg transition ${barber.active ? 'text-green-600 hover:bg-green-50' : 'text-red-400 hover:bg-red-50'}`} title={barber.active ? "Desactivar Barbero" : "Activar Barbero"}><Power size={18} /></button>
                        </div>
                      ))}
                   </div>
                   <div className="bg-slate-100 p-5 rounded-2xl border border-slate-200">
                      <h4 className="text-sm font-bold text-slate-600 mb-3 uppercase">Agregar Nuevo Barbero</h4>
                      <div className="grid grid-cols-2 gap-3 mb-3">
                         <input type="text" placeholder="Nombre" className="p-2 rounded-lg border border-slate-300 text-sm" value={newBarber.name} onChange={e => setNewBarber({...newBarber, name: e.target.value})} />
                         <input type="text" placeholder="Apellido" className="p-2 rounded-lg border border-slate-300 text-sm" value={newBarber.lastName} onChange={e => setNewBarber({...newBarber, lastName: e.target.value})} />
                      </div>
                      <div className="flex gap-3">
                         <div className="relative flex-1">
                            <input type="number" placeholder="Comisión %" className="w-full p-2 rounded-lg border border-slate-300 text-sm" value={newBarber.commission} onChange={e => setNewBarber({...newBarber, commission: e.target.value})} />
                            <span className="absolute right-3 top-2 text-xs text-slate-400">%</span>
                         </div>
                         <button onClick={handleAddBarber} disabled={!newBarber.name || !newBarber.lastName} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed">Guardar</button>
                      </div>
                   </div>
                </section>
                <section>
                   <div className="flex items-center justify-between mb-4"><h3 className="font-bold text-lg text-slate-700">Menú de Precios</h3></div>
                   <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden mb-6">
                      {services.map(service => (
                        <div key={service.id} className="p-4 border-b border-slate-100 last:border-0 flex items-center justify-between group">
                           <div className="flex items-center gap-3">
                              <div className="bg-yellow-100 p-2 rounded-lg text-yellow-700"><Scissors size={16} /></div>
                              <div><p className="font-bold text-slate-800">{service.name}</p><p className="text-xs text-slate-500 font-mono">${service.price.toLocaleString()}</p></div>
                           </div>
                           <button onClick={() => handleDeleteService(service.id)} className="text-slate-300 hover:text-red-500 p-2 transition opacity-0 group-hover:opacity-100"><Trash2 size={16} /></button>
                        </div>
                      ))}
                   </div>
                   <div className="bg-slate-100 p-5 rounded-2xl border border-slate-200">
                      <h4 className="text-sm font-bold text-slate-600 mb-3 uppercase">Nuevo Servicio</h4>
                      <div className="flex gap-3 mb-3">
                         <input type="text" placeholder="Nombre" className="flex-1 p-2 rounded-lg border border-slate-300 text-sm" value={newService.name} onChange={e => setNewService({...newService, name: e.target.value})} />
                         <input type="number" placeholder="Precio $" className="w-24 p-2 rounded-lg border border-slate-300 text-sm" value={newService.price} onChange={e => setNewService({...newService, price: e.target.value})} />
                      </div>
                      <button onClick={handleAddService} disabled={!newService.name || !newService.price} className="w-full bg-white border border-slate-300 text-slate-700 py-2 rounded-lg text-sm font-bold hover:bg-slate-50 disabled:opacity-50">Agregar al Menú</button>
                   </div>
                </section>
             </div>
          </div>
       </main>
    </div>
  );
}