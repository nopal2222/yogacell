
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, get, set, update, onValue, push, child } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDezxMn0AcFms3iMWs-9VkCVGEn-5TcMxY",
  authDomain: "juraganpulsa.firebaseapp.com",
  databaseURL: "https://juraganpulsa-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "juraganpulsa",
  storageBucket: "juraganpulsa.firebasestorage.app",
  messagingSenderId: "321197341289",
  appId: "1:321197341289:web:974588ab7555b55fc4c0f8"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export function formatRupiah(num) {
    return "Rp " + num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}


export function listenData(path, callback) {
    const dataRef = ref(db, path);1
    onValue(dataRef, (snapshot) => {
        const data = snapshot.val();
        callback(data);
    });
}

// 2. INIT DATA AWAL (JIKA KOSONG)
export async function initDB() {
    const dbRef = ref(db);
    get(child(dbRef, `products`)).then((snapshot) => {
        if (!snapshot.exists()) {
            const defaults = [
                { code: 'PLN20', name: 'Token PLN 20.000', category: 'PLN', modal: 20150, status: 'LANCAR' },
                { code: 'PLN50', name: 'Token PLN 50.000', category: 'PLN', modal: 50150, status: 'LANCAR' },
                { code: 'TN10', name: 'Telkomsel 10.000', category: 'PULSA', modal: 10350, status: 'LANCAR' },
                { code: 'TN25', name: 'Telkomsel 25.000', category: 'PULSA', modal: 25200, status: 'GANGGUAN' },
                { code: 'DN20', name: 'Saldo DANA 20k', category: 'E-WALLET', modal: 20500, status: 'LANCAR' }
            ];
            set(ref(db, 'products'), defaults);
        }
    });

    get(child(dbRef, `agents`)).then((snapshot) => {
        if (!snapshot.exists()) {
            // Set Agen Default: ID=AGEN001 PIN=1234
            set(ref(db, 'agents/AGEN001'), { 
                id: 'AGEN001', name: 'Konter Berkah', pin: '1234', saldo: 0, profit: 0 
            });
        }
    });
}

// 3. TRANSAKSI (ATOMIC UPDATE)
export async function prosesTransaksi(agentId, pin, productCode, targetNo, hargaJual) {
    const dbRef = ref(db);
    
    // Ambil Data Terbaru Sekali (Snapshot)
    const agentSnap = await get(child(dbRef, `agents/${agentId}`));
    const prodsSnap = await get(child(dbRef, `products`));
    
    if (!agentSnap.exists()) throw "ID Agen Tidak Ditemukan!";
    
    let agent = agentSnap.val();
    let products = prodsSnap.val();
    let prod = products.find(p => p.code === productCode);

    // Validasi
    if (agent.pin !== pin) throw "PIN SALAH!";
    if (!prod) throw "Produk Tidak Valid!";
    if (prod.status !== 'LANCAR') throw "Produk Sedang GANGGUAN!";
    if (agent.saldo < prod.modal) throw "SALDO TIDAK CUKUP!";

    // Hitungan
    let profit = parseInt(hargaJual) - prod.modal;
    let newSaldo = agent.saldo - prod.modal;
    let newProfit = agent.profit + profit;

    // Siapkan Data Transaksi
    let trxId = "TRX-" + Date.now();
    let sn = "SN" + Date.now().toString().slice(-8) + Math.floor(Math.random() * 999);
    
    let newTrx = {
        id: trxId,
        time: new Date().toLocaleString(),
        agent_id: agentId,
        product: prod.name,
        code: prod.code,
        target: targetNo,
        modal: prod.modal,
        jual: parseInt(hargaJual),
        profit: profit,
        sn: sn,
        status: 'SUKSES'
    };

    // UPDATE DATABASE SEKALIGUS (Saldo Berkurang + Transaksi Masuk)
    const updates = {};
    updates['/agents/' + agentId + '/saldo'] = newSaldo;
    updates['/agents/' + agentId + '/profit'] = newProfit;
    updates['/transactions/' + trxId] = newTrx;

    await update(ref(db), updates);
    return newTrx;
}

// 4. DEPOSIT SALDO
export function depositSaldo(agentId, currentSaldo, amount) {
    let finalSaldo = parseInt(currentSaldo) + parseInt(amount);
    update(ref(db, 'agents/' + agentId), { saldo: finalSaldo });
}

// 5. UPDATE STATUS PRODUK
export async function toggleProductStatus(code) {
    const dbRef = ref(db);
    const snapshot = await get(child(dbRef, 'products'));
    let products = snapshot.val();
    let idx = products.findIndex(p => p.code === code);
    
    if (idx !== -1) {
        let newStatus = products[idx].status === 'LANCAR' ? 'GANGGUAN' : 'LANCAR';
        update(ref(db, `products/${idx}`), { status: newStatus });
    }
}

// 6. TAMBAH AGEN BARU (FITUR BARU)
export async function tambahAgenBaru(id, nama, pin) {
    const dbRef = ref(db);
    const snapshot = await get(child(dbRef, `agents/${id}`));
    
    if (snapshot.exists()) {
        throw "ID AGEN SUDAH ADA! Ganti ID lain.";
    }

    await set(ref(db, `agents/${id}`), {
        id: id,
        name: nama,
        pin: pin,
        saldo: 0,
        profit: 0
    });
}
// ... (Kode sebelumnya tetap sama) ...

// 7. FITUR SHARE STRUK (GENERATE GAMBAR)
// Butuh library html2canvas di file HTML nanti
export function generateStrukImage(elementId) {
    return new Promise((resolve, reject) => {
        const node = document.getElementById(elementId);
        
        // Panggil library global html2canvas
        if (typeof window.html2canvas === 'undefined') {
            reject("Library html2canvas belum dipasang!");
            return;
        }

        window.html2canvas(node, {
            scale: 2, // Biar tajam
            backgroundColor: "#ffffff"
        }).then(canvas => {
            // Convert ke format gambar
            const imgData = canvas.toDataURL("image/jpeg", 0.9);
            resolve(imgData);
        }).catch(err => reject(err));
    });
}
