// --- 1. FIREBASE CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyDZEvI38fPevW6aCmMNuyOD5-qhC1Kxtno",
    authDomain: "cs-portfolio-77a85.firebaseapp.com",
    projectId: "cs-portfolio-77a85",
    storageBucket: "cs-portfolio-77a85.appspot.com",
    messagingSenderId: "1051061696714",
    appId: "1:1051061696714:web:debe6a8237cc9c1e129c33",
    measurementId: "G-74Y1M2XRSQ"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// --- CURRICULUM DATA ---
const curriculumMap = {
    1: [
        { name: 'Computer Organisation and Architecture', code: 'ICT/CU/CS/CR/01/6/MA', core: true },
        { name: 'Operating Systems Configuration', code: 'ICT/CU/CS/CR/02/6/MA', core: true }
    ],
    2: [
        { name: 'Networking and Distributed Systems', code: 'ICT/CU/CS/CR/03/6/MA', core: true },
        { name: 'Graphics Design', code: 'ICT/CU/CS/CR/04/6/MA', core: true }
    ],
    3: [
        { name: 'Database Management', code: 'ICT/CU/CS/CR/05/6/MA', core: true },
        { name: 'Web Designing', code: 'ICT/CU/CS/CR/06/6/MA', core: true }
    ],
    4: [
        { name: 'Basic Electronic Skills', code: 'ICT/CU/CS/CC/01/6/MA', core: true },
        { name: 'Fundamentals of Programming', code: 'ICT/CU/CS/CC/02/6/MA', core: true },
        { name: 'Work Ethics and Practices', code: 'ICT/CU/CS/BC/02/6/MA', core: false }
    ],
    5: [
        { name: 'Entrepreneurial Skills', code: 'ICT/CU/CS/BC/03/6/MA', core: false },
        { name: 'Algorithms and Data Structures', code: 'ICT/CU/CS/CR/07/6/MA', core: true },
        { name: 'Mathematics for Computer Science', code: 'ICT/CU/CS/CC/03/6/MA', core: true }
    ],
    6: [
        { name: 'Communication Skills', code: 'ICT/CU/CS/BC/01/6/MA', core: false },
        { name: 'Information Systems Development', code: 'ICT/CU/CS/CR/08/6/MA', core: true },
        { name: 'Artificial Intelligence Concepts', code: 'ICT/CU/CS/CC/04/6/MA', core: true }
    ]
};

let papers = [];
let manualPapers = [];
let currentSemester = 1;
let selectedFile = null;
let currentUser = null;

// --- 2. AUTHENTICATION LISTENER ---
document.addEventListener('DOMContentLoaded', () => {
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            console.log("Logged in as:", user.email);
            initApp();
        } else {
            currentUser = null;
            updateAuthButton();
            renderSemester(currentSemester);
            updateStats();
        }
    });
});

// --- 3. INIT FUNCTION ---
function initApp() {
    updateAuthButton();
    loadPapersFromDB(currentSemester);
    setupDragDrop();
}

// --- UI RENDERING FOR AUTH ---
function updateAuthButton() {
    const btn = document.getElementById('authBtn');
    const text = document.getElementById('authText');
    const icon = document.getElementById('loginIcon');

    if (!btn || !text) return;

    if (currentUser) {
        const name = currentUser.email.split('@')[0];
        text.textContent = `Logout (${name})`;
        if (icon) icon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>`;
        btn.onclick = logout;
    } else {
        text.textContent = 'Login to Upload';
        if (icon) icon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/>`;
        btn.onclick = login;
    }
}

function handleAuthClick() {
    if (currentUser) { logout(); } else { login(); }
}

const login = async () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        await auth.signInWithPopup(provider);
    } catch (error) {
        console.error("Login error:", error);
        alert("Login failed: " + error.message);
    }
};

const logout = async () => {
    await auth.signOut();
    location.reload();
};

// --- 4. DATABASE FUNCTIONS ---
async function loadPapersFromDB(sem) {
    try {
        const snapshot = await db.collection('papers').where('semester', '==', sem).get();
        let firebasePapers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        let manualPapersForSem = manualPapers.filter(p => p.semester === sem);
        papers = [...manualPapersForSem, ...firebasePapers];
        renderSemester(sem);
        updateStats();
    } catch (error) {
        console.error("Error loading papers:", error);
        papers = manualPapers.filter(p => p.semester === sem);
        renderSemester(sem);
        updateStats();
    }
}

async function deletePaper(id) {
    if (!currentUser) return alert("Please login to delete.");
    if (!confirm('Are you sure you want to delete this paper?')) return;

    const paper = papers.find(p => p.id === id);

    // Prevent deleting manual papers from UI (they must be removed from code)
    if (id.startsWith('manual-')) {
        return alert("This paper is hardcoded in the script. Please remove it from the manualPapers list in script.js to delete it.");
    }

    if (paper.fileUrl) {
        const fileRef = storage.refFromURL(paper.fileUrl);
        await fileRef.delete();
    }
    await db.collection('papers').doc(id).delete();
    showNotification('Paper deleted');
    loadPapersFromDB(currentSemester);
}

// --- 5. UPLOAD HANDLER ---
function handleUpload(event) {
    event.preventDefault();
    if (!currentUser) return alert("Please login to upload papers.");
    if (!selectedFile) return alert('Please select a file to upload');

    const semester = parseInt(document.getElementById('uploadSemester').value);
    const unitCode = document.getElementById('uploadUnitCode').value;
    const type = document.getElementById('uploadType').value;
    const mode = document.getElementById('uploadMode').value;
    const score = document.getElementById('uploadScore').value || null;

    showNotification("Uploading... please wait.");

    const fileName = `${unitCode}_${type}_${mode}_${Date.now()}.${selectedFile.name.split('.').pop()}`;
    const storageRef = storage.ref(`exams/${semester}/${fileName}`);

    const uploadTask = storageRef.put(selectedFile);

    uploadTask.on('state_changed', null,
        (error) => { console.error(error); alert("Upload failed: " + error.message); },
        async () => {
            const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
            const paperData = {
                semester: semester, unitCode: unitCode, type: type, mode: mode, score: score,
                fileName: selectedFile.name,
                fileType: selectedFile.type.includes('pdf') ? 'pdf' : (selectedFile.type.includes('video') ? 'video' : 'image'),
                fileMimeType: selectedFile.type, fileSize: selectedFile.size,
                fileUrl: downloadURL, uploadedBy: currentUser.email,
                uploadedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            const existingQuery = await db.collection('papers')
                .where('unitCode', '==', unitCode).where('type', '==', type)
                .where('mode', '==', mode).where('semester', '==', semester).get();

            if (!existingQuery.empty) {
                existingQuery.forEach(async (doc) => {
                    const oldData = doc.data();
                    if (oldData.fileUrl) { try { await storage.refFromURL(oldData.fileUrl).delete(); } catch (e) { } }
                    await doc.ref.delete();
                });
            }
            await db.collection('papers').add(paperData);
            closeUploadModal();
            loadPapersFromDB(currentSemester);
            showNotification('Paper uploaded successfully!');
        }
    );
}


// ==========================================
// --- MANUAL PAPERS DATA (FIXED LINKS) ---
// ==========================================
manualPapers = [

    // ==========================================
    // MODULE I
    // ==========================================
    {
        id: 'manual-arch-cat1', semester: 1, unitCode: 'ICT/CU/CS/CR/01/6/MA',
        type: 'cat1', mode: 'theory', score: '',
        fileName: 'CAT 1 - COMPUTER ARCHITECTURE.pdf', fileType: 'pdf', fileSize: 100000,
        fileUrl: 'https://joshua-wawira-portfolio.netlify.app/FILES/COMPUTER ARCHITECTURE AND ORGANIZATION CAT 1.pdf',
    },
    {
        id: 'manual-arch-cat2', semester: 1, unitCode: 'ICT/CU/CS/CR/01/6/MA',
        type: 'cat2', mode: 'theory', score: '',
        fileName: 'CAT 2 - COMPUTER ARCHITECTURE.pdf', fileType: 'pdf', fileSize: 100000,
        fileUrl: 'https://joshua-wawira-portfolio.netlify.app/FILES/COMPUTER ARCHITECTURE AND ORGANIZATION CAT 2.pdf',
    },
    {
        id: 'manual-arch-mock', semester: 1, unitCode: 'ICT/CU/CS/CR/01/6/MA',
        type: 'mock', mode: 'theory', score: '',
        fileName: 'Mock - Architecture.pdf', fileType: 'pdf', fileSize: 100000,
        fileUrl: 'https://joshua-wawira-portfolio.netlify.app/FILES/COMPUTER%20ARCHITECTURE%20AND%20ORGANIZATION%20MOCK.pdf',
    },
    {
        id: 'manual-arch-prac1', semester: 1, unitCode: 'ICT/CU/CS/CR/01/6/MA',
        type: 'cat1', mode: 'practical', score: '',
        fileName: 'Practical 1 - Architecture.jpg', fileType: 'image', fileSize: 500000,
        fileUrl: 'https://joshua-wawira-portfolio.netlify.app/FILES/ARCH_PRAC1.jpg',
    },
    {
        id: 'manual-os-mock', semester: 1, unitCode: 'ICT/CU/CS/CR/02/6/MA',
        type: 'mock', mode: 'theory', score: '70%',
        fileName: 'Mock - OS.pdf', fileType: 'pdf', fileSize: 200000,
        fileUrl: 'https://joshua-wawira-portfolio.netlify.app/FILES/OS_MOCK.pdf',
    },

    // ==========================================
    // MODULE II
    // ==========================================
    // Networking and Distributed Systems
    {
        id: 'manual-net-cat1', semester: 2, unitCode: 'ICT/CU/CS/CR/03/6/MA',
        type: 'cat1', mode: 'theory', score: '',
        fileName: 'CAT 1 - Networking.pdf', fileType: 'pdf', fileSize: 120000,
        fileUrl: 'https://joshua-wawira-portfolio.netlify.app/FILES/NET_CAT1.pdf',
    },
    {
        id: 'manual-net-cat2', semester: 2, unitCode: 'ICT/CU/CS/CR/03/6/MA',
        type: 'cat2', mode: 'theory', score: '',
        fileName: 'CAT 2 - Networking.pdf', fileType: 'pdf', fileSize: 120000,
        fileUrl: 'https://joshua-wawira-portfolio.netlify.app/FILES/NET_CAT2.pdf',
    },
    {
        id: 'manual-net-mock', semester: 2, unitCode: 'ICT/CU/CS/CR/03/6/MA',
        type: 'mock', mode: 'theory', score: '',
        fileName: 'Mock - Networking.pdf', fileType: 'pdf', fileSize: 120000,
        fileUrl: 'https://joshua-wawira-portfolio.netlify.app/FILES/NET_MOCK.pdf',
    },
    {
        id: 'manual-net-prac1', semester: 2, unitCode: 'ICT/CU/CS/CR/03/6/MA',
        type: 'cat1', mode: 'practical', score: '',
        fileName: 'Practical 1 - Networking.pdf', fileType: 'pdf', fileSize: 120000,
        fileUrl: 'https://joshua-wawira-portfolio.netlify.app/FILES/NET_PRAC1.pdf',
    },
    {
        id: 'manual-net-prac2', semester: 2, unitCode: 'ICT/CU/CS/CR/03/6/MA',
        type: 'cat2', mode: 'practical', score: '',
        fileName: 'Practical 2 - Networking.pdf', fileType: 'pdf', fileSize: 120000,
        fileUrl: 'https://joshua-wawira-portfolio.netlify.app/FILES/NET_PRAC2.pdf',
    },
    {
        id: 'manual-net-prac3', semester: 2, unitCode: 'ICT/CU/CS/CR/03/6/MA',
        type: 'mock', mode: 'practical', score: '',
        fileName: 'Practical 3 - Networking.pdf', fileType: 'pdf', fileSize: 120000,
        fileUrl: 'https://joshua-wawira-portfolio.netlify.app/FILES/NET_PRAC3.pdf',
    },

    // Graphics Design
    {
        id: 'manual-graphics-cat1', semester: 2, unitCode: 'ICT/CU/CS/CR/04/6/MA',
        type: 'cat1', mode: 'theory', score: '',
        fileName: 'CAT 1 - Graphics.pdf', fileType: 'pdf', fileSize: 120000,
        fileUrl: 'https://joshua-wawira-portfolio.netlify.app/FILES/GRAPHICS_CAT1.pdf',
    },
    {
        id: 'manual-graphics-cat2', semester: 2, unitCode: 'ICT/CU/CS/CR/04/6/MA',
        type: 'cat2', mode: 'theory', score: '',
        fileName: 'CAT 2 - Graphics.pdf', fileType: 'pdf', fileSize: 120000,
        fileUrl: 'https://joshua-wawira-portfolio.netlify.app/FILES/GRAPHICS_CAT2.pdf',
    },
    {
        id: 'manual-graphics-mock', semester: 2, unitCode: 'ICT/CU/CS/CR/04/6/MA',
        type: 'mock', mode: 'theory', score: '',
        fileName: 'Mock - Graphics.pdf', fileType: 'pdf', fileSize: 120000,
        fileUrl: 'https://joshua-wawira-portfolio.netlify.app/FILES/GRAPHICS_MOCK.pdf',
    },
    {
        id: 'manual-graphics-prac1', semester: 2, unitCode: 'ICT/CU/CS/CR/04/6/MA',
        type: 'cat1', mode: 'practical', score: '',
        fileName: 'Practical 1 - Graphics.pdf', fileType: 'pdf', fileSize: 120000,
        fileUrl: 'https://joshua-wawira-portfolio.netlify.app/FILES/GRAPHICS_PRAC1.pdf',
    },
    {
        id: 'manual-graphics-prac2', semester: 2, unitCode: 'ICT/CU/CS/CR/04/6/MA',
        type: 'cat2', mode: 'practical', score: '',
        fileName: 'Practical 2 - Graphics.pdf', fileType: 'pdf', fileSize: 120000,
        fileUrl: 'https://joshua-wawira-portfolio.netlify.app/FILES/GRAPHICS_PRAC2.pdf',
    },
    {
        id: 'manual-graphics-prac3', semester: 2, unitCode: 'ICT/CU/CS/CR/04/6/MA',
        type: 'mock', mode: 'practical', score: '',
        fileName: 'Practical 3 - Graphics.pdf', fileType: 'pdf', fileSize: 120000,
        fileUrl: 'https://joshua-wawira-portfolio.netlify.app/FILES/GRAPHICS_PRAC3.pdf',
    },

    // ==========================================
    // MODULE III
    // ==========================================
    // Database Management
    {
        id: 'manual-mod3-db-cat1', semester: 3, unitCode: 'ICT/CU/CS/CR/05/6/MA',
        type: 'cat1', mode: 'theory', score: '',
        fileName: 'CAT 1 - Database.pdf', fileType: 'pdf', fileSize: 150000,
        fileUrl: 'https://joshua-wawira-portfolio.netlify.app/FILES/DB_CAT1.pdf',
    },
    {
        id: 'manual-mod3-db-cat2', semester: 3, unitCode: 'ICT/CU/CS/CR/05/6/MA',
        type: 'cat2', mode: 'theory', score: '',
        fileName: 'CAT 2 - Database.pdf', fileType: 'pdf', fileSize: 150000,
        fileUrl: 'https://joshua-wawira-portfolio.netlify.app/FILES/DB_CAT2.pdf',
    },
    {
        id: 'manual-mod3-db-mock', semester: 3, unitCode: 'ICT/CU/CS/CR/05/6/MA',
        type: 'mock', mode: 'theory', score: '',
        fileName: 'Mock - Database.pdf', fileType: 'pdf', fileSize: 150000,
        fileUrl: 'https://joshua-wawira-portfolio.netlify.app/FILES/DB_MOCK.pdf',
    },
    {
        id: 'manual-mod3-db-prac1', semester: 3, unitCode: 'ICT/CU/CS/CR/05/6/MA',
        type: 'cat1', mode: 'practical', score: '',
        fileName: 'Practical 1 - Database.pdf', fileType: 'pdf', fileSize: 150000,
        fileUrl: 'https://joshua-wawira-portfolio.netlify.app/FILES/DB_PRAC1.pdf',
    },
    {
        id: 'manual-mod3-db-prac2', semester: 3, unitCode: 'ICT/CU/CS/CR/05/6/MA',
        type: 'cat2', mode: 'practical', score: '',
        fileName: 'Practical 2 - Database.pdf', fileType: 'pdf', fileSize: 150000,
        fileUrl: 'https://joshua-wawira-portfolio.netlify.app/FILES/DB_PRAC2.pdf',
    },

    // Web Designing
    {
        id: 'manual-mod3-web-cat1', semester: 3, unitCode: 'ICT/CU/CS/CR/06/6/MA',
        type: 'cat1', mode: 'theory', score: '',
        fileName: 'PERFOM WEB DESIGN CAT 1.pdf', fileType: 'pdf', fileSize: 150000,
        fileUrl: 'https://joshua-wawira-portfolio.netlify.app/FILES/PERFOM WEB DESIGN CAT 1.pdf',
    },
    {
        id: 'manual-mod3-web-cat2', semester: 3, unitCode: 'ICT/CU/CS/CR/06/6/MA',
        type: 'cat2', mode: 'theory', score: '',
        fileName: 'CAT 2 - Web Designing.pdf', fileType: 'pdf', fileSize: 150000,
        fileUrl: 'https://joshua-wawira-portfolio.netlify.app/FILES/WEB_CAT2.pdf',
    },
    {
        id: 'manual-mod3-web-mock', semester: 3, unitCode: 'ICT/CU/CS/CR/06/6/MA',
        type: 'mock', mode: 'theory', score: '',
        fileName: 'Mock - Web Designing.pdf', fileType: 'pdf', fileSize: 200000,
        fileUrl: 'https://joshua-wawira-portfolio.netlify.app/FILES/WEB_MOCK.pdf',
    },
    {
        id: 'manual-mod3-web-prac1', semester: 3, unitCode: 'ICT/CU/CS/CR/06/6/MA',
        type: 'cat1', mode: 'practical', score: '',
        fileName: 'Practical 1 - Web Designing.pdf', fileType: 'pdf', fileSize: 150000,
        fileUrl: 'https://joshua-wawira-portfolio.netlify.app/FILES/PERFOM WEB DESIGN PRACTICAL 1.pdf',
    },

    // ==========================================
    // MODULE IV (Fixed Unit Codes)
    // ==========================================
    // 1. Basic Electronic Skills -> Code: ICT/CU/CS/CC/01/6/MA
    {
        id: 'manual-mod4-elect-cat1', semester: 4, unitCode: 'ICT/CU/CS/CC/01/6/MA',
        type: 'cat1', mode: 'theory', score: '',
        fileName: 'BASIC ELECTRONICS CAT1.pdf', fileType: 'pdf', fileSize: 150000,
        fileUrl: 'https://joshua-wawira-portfolio.netlify.app/FILES/BASIC ELECTRONICS CAT 1.pdf',
    },
    {
        id: 'manual-mod4-elect-cat2', semester: 4, unitCode: 'ICT/CU/CS/CC/01/6/MA',
        type: 'cat2', mode: 'theory', score: '',
        fileName: 'BASIC ELECTRONICS CAT2.pdf', fileType: 'pdf', fileSize: 150000,
        fileUrl: 'https://joshua-wawira-portfolio.netlify.app/FILES/BASICS ELECTRONICS CAT 2.pdf',
    },
    // 2. Fundamentals of Programming -> Code: ICT/CU/CS/CC/02/6/MA
    {
        id: 'manual-mod4-prog-cat1', semester: 4, unitCode: 'ICT/CU/CS/CC/02/6/MA',
        type: 'cat1', mode: 'theory', score: '',
        fileName: 'CAT 1 - Fundamentals of Programming.pdf', fileType: 'pdf', fileSize: 150000,
        fileUrl: 'https://joshua-wawira-portfolio.netlify.app/FILES/PROGRAMMING_CAT1.pdf',
    },
    {
        id: 'manual-mod4-prog-cat2', semester: 4, unitCode: 'ICT/CU/CS/CC/02/6/MA',
        type: 'cat2', mode: 'theory', score: '',
        fileName: 'CAT 2 - Fundamentals of Programming.pdf', fileType: 'pdf', fileSize: 150000,
        fileUrl: 'https://joshua-wawira-portfolio.netlify.app/FILES/PROGRAMMING_CAT2.pdf',
    },
    // 3. Work Ethics -> Code: ICT/CU/CS/BC/02/6/MA
    {
        id: 'manual-mod4-ethics-cat1', semester: 4, unitCode: 'ICT/CU/CS/BC/02/6/MA',
        type: 'cat1', mode: 'theory', score: '',
        fileName: 'CAT 1 - Work Ethics.pdf', fileType: 'pdf', fileSize: 150000,
        fileUrl: 'https://joshua-wawira-portfolio.netlify.app/FILES/WORK_ETHICS_CAT1.pdf',
    },
    {
        id: 'manual-mod4-ethics-cat2', semester: 4, unitCode: 'ICT/CU/CS/BC/02/6/MA',
        type: 'cat2', mode: 'theory', score: '',
        fileName: 'CAT 2 - Work Ethics.pdf', fileType: 'pdf', fileSize: 150000,
        fileUrl: 'https://joshua-wawira-portfolio.netlify.app/FILES/WORK_ETHICS_CAT2.pdf',
    },

    // ==========================================
    // MODULE V (Fixed Unit Codes)
    // ==========================================
    // 1. Entrepreneurial Skills -> Code: ICT/CU/CS/BC/03/6/MA
    {
        id: 'manual-mod5-entrep-cat1', semester: 5, unitCode: 'ICT/CU/CS/BC/03/6/MA',
        type: 'cat1', mode: 'theory', score: '',
        fileName: 'CAT 1 - Entrepreneurial Skills.pdf', fileType: 'pdf', fileSize: 150000,
        fileUrl: 'https://joshua-wawira-portfolio.netlify.app/FILES/ENTREPRENEURSHIP_CAT1.pdf',
    },
    {
        id: 'manual-mod5-entrep-cat2', semester: 5, unitCode: 'ICT/CU/CS/BC/03/6/MA',
        type: 'cat2', mode: 'theory', score: '',
        fileName: 'CAT 2 - Entrepreneurial Skills.pdf', fileType: 'pdf', fileSize: 150000,
        fileUrl: 'https://joshua-wawira-portfolio.netlify.app/FILES/ENTREPRENEURSHIP_CAT2.pdf',
    },
    // 2. Algorithms -> Code: ICT/CU/CS/CR/07/6/MA
    {
        id: 'manual-mod5-algo-cat1', semester: 5, unitCode: 'ICT/CU/CS/CR/07/6/MA',
        type: 'cat1', mode: 'theory', score: '',
        fileName: 'CAT 1 - Algorithms.pdf', fileType: 'pdf', fileSize: 150000,
        fileUrl: 'https://joshua-wawira-portfolio.netlify.app/FILES/ALGORITHMS_CAT1.pdf',
    },
    {
        id: 'manual-mod5-algo-cat2', semester: 5, unitCode: 'ICT/CU/CS/CR/07/6/MA',
        type: 'cat2', mode: 'theory', score: '',
        fileName: 'CAT 2 - Algorithms.pdf', fileType: 'pdf', fileSize: 150000,
        fileUrl: 'https://joshua-wawira-portfolio.netlify.app/FILES/ALGORITHMS_CAT2.pdf',
    },
    {
        id: 'manual-mod5-algo-prac1', semester: 5, unitCode: 'ICT/CU/CS/CR/07/6/MA',
        type: 'cat1', mode: 'practical', score: '',
        fileName: 'Practical 1 - Algorithms.pdf', fileType: 'pdf', fileSize: 500000,
        fileUrl: 'https://joshua-wawira-portfolio.netlify.app/FILES/MOD5_ALGORITHMS_PRAC1.pdf',
    },
    // 3. Mathematics -> Code: ICT/CU/CS/CC/03/6/MA
    {
        id: 'manual-mod5-math-cat1', semester: 5, unitCode: 'ICT/CU/CS/CC/03/6/MA',
        type: 'cat1', mode: 'theory', score: '',
        fileName: 'MATHS FOR COMPUTER SCIENCE CAT 1.pdf', fileType: 'pdf', fileSize: 150000,
        fileUrl: 'https://joshua-wawira-portfolio.netlify.app/FILES/MATHS FOR COMPUTER SCIENCE CAT 1.pdf',
    },
    {
        id: 'manual-mod5-math-cat2', semester: 5, unitCode: 'ICT/CU/CS/CC/03/6/MA',
        type: 'cat2', mode: 'theory', score: '',
        fileName: 'MATHS FOR COMPUTER SCIENCE CAT 2.pdf', fileType: 'pdf', fileSize: 150000,
        fileUrl: 'https://joshua-wawira-portfolio.netlify.app/FILES/MATHS FOR COMPUTER SCIENCE CAT 2.pdf',
    },
    {
        id: 'manual-mod5-math-mock', semester: 5, unitCode: 'ICT/CU/CS/CC/03/6/MA',
        type: 'mock', mode: 'theory', score: '',
        fileName: 'MOCK_MATHS.pdf', fileType: 'pdf', fileSize: 200000,
        fileUrl: 'https://joshua-wawira-portfolio.netlify.app/FILES/MOCK_MATHS.pdf',
    },

    // ==========================================
    // MODULE VI
    // ==========================================
    //1. Communication Skills -> Code: ICT/CU/CS/BC/01/6/MA
    {
        id: 'manual-mod6-comm-cat1', semester: 6, unitCode: 'ICT/CU/CS/BC/01/6/MA',
        type: 'cat1', mode: 'theory', score: '',
        fileName: 'COMMUNICATION SKILLS CAT 1.pdf', fileType: 'pdf', fileSize: 150000,
        fileUrl: 'https://joshua-wawira-portfolio.netlify.app/FILES/COMMUNICATION SKILLS CAT 1.pdf',
    },
    {
        id: 'manual-mod6-comm-cat2', semester: 6, unitCode: 'ICT/CU/CS/BC/01/6/MA',
        type: 'cat2', mode: 'theory', score: '',
        fileName: 'COMMUNICATION SKILLS CAT 2.pdf', fileType: 'pdf', fileSize: 150000,
        fileUrl: 'https://joshua-wawira-portfolio.netlify.app/FILES/COMMUNICATION SKILLS CAT 2.pdf',
    },
    {
        id: 'manual-mod6-comm-mock', semester: 6, unitCode: 'ICT/CU/CS/BC/01/6/MA',
        type: 'mock', mode: 'theory', score: '',
        fileName: 'MOCK_COMMUNICATION.pdf', fileType: 'pdf', fileSize: 200000,
        fileUrl: 'https://joshua-wawira-portfolio.netlify.app/FILES/MOCK_COMMUNICATION.pdf',
    },
    //2. Information Systems Development -> Code: ICT/CU/CS/CR/08/6/MA
    {
        id: 'manual-mod6-isd-cat1', semester: 6, unitCode: 'ICT/CU/CS/CR/08/6/MA',
        type: 'cat1', mode: 'theory', score: '',
        fileName: 'CAT 1 - Info Systems.pdf', fileType: 'pdf', fileSize: 120000,
        fileUrl: 'https://joshua-wawira-portfolio.netlify.app/FILES/MOD6_ISD_CAT1.pdf',
    },
    {
        id: 'manual-mod6-isd-prac1', semester: 6, unitCode: 'ICT/CU/CS/CR/08/6/MA',
        type: 'cat1', mode: 'practical', score: '',
        fileName: 'Practical 1 - Info Systems.pdf', fileType: 'pdf', fileSize: 500000,
        fileUrl: 'https://joshua-wawira-portfolio.netlify.app/FILES/MOD6_ISD_PRAC1.pdf',
    },
    //3. Artificial Intelligence -> Code: ICT/CU/CS/CC/04/6/MA
    {
        id: 'manual-mod6-ai-cat1', semester: 6, unitCode: 'ICT/CU/CS/CC/04/6/MA',
        type: 'cat1', mode: 'theory', score: '',
        fileName: 'CAT 1 - AI.pdf', fileType: 'pdf', fileSize: 130000,
        fileUrl: 'https://joshua-wawira-portfolio.netlify.app/FILES/MOD6_AI_CAT1.pdf',
    },
    {
        id: 'manual-mod6-ai-video', semester: 6, unitCode: 'ICT/CU/CS/CC/04/6/MA',
        type: 'video1', mode: 'video', score: '',
        fileName: 'AI Project Video.mp4', fileType: 'video', fileSize: 5000000,
        fileUrl: 'https://joshua-wawira-portfolio.netlify.app/FILES/MOD6_AI_VIDEO.mp4',
    }
];


// --- 6. HELPER FUNCTIONS ---
function setupDragDrop() {
    const dropZone = document.getElementById('dropZone');
    if (!dropZone) return;
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });
    function preventDefaults(e) { e.preventDefault(); e.stopPropagation(); }
    ['dragenter', 'dragover'].forEach(eventName => { dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false); });
    ['dragleave', 'drop'].forEach(eventName => { dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false); });
    dropZone.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files.length > 0) handleFileSelect({ target: { files: files } });
    }, false);
}

function populateUnits() {
    const sem = document.getElementById('uploadSemester').value;
    const unitSelect = document.getElementById('uploadUnitCode');
    if (!unitSelect) return;
    unitSelect.innerHTML = '<option value="">Select Unit</option>';
    if (sem && curriculumMap[sem]) {
        curriculumMap[sem].forEach(unit => {
            const option = document.createElement('option');
            option.value = unit.code;
            option.textContent = `${unit.name} (${unit.code})`;
            option.dataset.core = unit.core;
            unitSelect.appendChild(option);
        });
    }
}

function switchSemester(sem) {
    currentSemester = sem;
    document.querySelectorAll('.semester-tab').forEach(tab => {
        tab.classList.toggle('active', parseInt(tab.dataset.semester) === sem);
    });
    loadPapersFromDB(sem);
}

// --- RENDER SEMESTER ---
function renderSemester(sem) {
    const container = document.getElementById('semesterContent');
    if (!container) return;
    const units = curriculumMap[sem];
    const semesterPapers = papers.filter(p => p.semester === sem);

    let html = `<div class="mb-8">
    <div class="flex items-center gap-3 mb-6">
      <div class="w-1 h-8 bg-[var(--accent)] rounded"></div>
      <div>
        <h2 class="text-2xl font-bold">Module ${sem}</h2>
        <p class="text-sm text-[var(--muted)] font-mono">KNQF Level 6 Units</p>
      </div>
    </div>
    <div class="grid gap-6">`;

    units.forEach((unit, index) => {
        const delay = index * 0.1;
        html += `
      <div class="card p-6" style="animation: fadeSlideIn 0.5s ease forwards ${delay}s; opacity: 0;">
        <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
          <div>
            <div class="flex items-center gap-2 mb-1 flex-wrap">
              <span class="unit-code-badge font-mono text-xs text-[var(--accent)] bg-[var(--accent-dim)] px-2 py-1 rounded">${unit.code}</span>
              <span class="text-xs text-[var(--muted)]">${unit.core ? 'Core' : 'Common'}</span>
            </div>
            <h3 class="text-lg font-semibold">${unit.name}</h3>
          </div>
        </div>
        
        <div class="flex gap-2 mb-4 border-b border-[var(--border)] pb-2 overflow-x-auto">
          <button class="sub-tab active" onclick="switchSubTab(this, 'theory-${unit.code}')">Theory</button>
          ${unit.core ? `<button class="sub-tab" onclick="switchSubTab(this, 'practical-${unit.code}')">Practical</button>` : ''}
          ${unit.core ? `<button class="sub-tab" onclick="switchSubTab(this, 'video-${unit.code}')">Video Evidence</button>` : ''}
        </div>

        <div id="theory-${unit.code}" class="grid grid-cols-1 md:grid-cols-3 gap-3">
          ${renderExamSlot(sem, unit.code, 'cat1', 'CAT 1', semesterPapers, 'theory')}
          ${renderExamSlot(sem, unit.code, 'cat2', 'CAT 2', semesterPapers, 'theory')}
          ${renderExamSlot(sem, unit.code, 'mock', 'Mock', semesterPapers, 'theory')}
        </div>

        ${unit.core ? `
        <div id="practical-${unit.code}" class="grid grid-cols-1 md:grid-cols-3 gap-3 hidden">
          ${renderExamSlot(sem, unit.code, 'cat1', 'Practical 1', semesterPapers, 'practical')}
          ${renderExamSlot(sem, unit.code, 'cat2', 'Practical 2', semesterPapers, 'practical')}
          ${renderExamSlot(sem, unit.code, 'mock', 'Practical 3', semesterPapers, 'practical')}
        </div>
        
        <div id="video-${unit.code}" class="grid grid-cols-1 md:grid-cols-3 gap-3 hidden">
          ${renderVideoSlot(sem, unit.code, 'video1', 'Video 1', semesterPapers)}
          ${renderVideoSlot(sem, unit.code, 'video2', 'Video 2', semesterPapers)}
          ${renderVideoSlot(sem, unit.code, 'video3', 'Video 3', semesterPapers)}
        </div>
        ` : ''}
      </div>`;
    });

    html += `</div></div>`;
    container.innerHTML = html;
}

function switchSubTab(btn, targetId) {
    const parent = btn.closest('.card');
    parent.querySelectorAll('.sub-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    parent.querySelectorAll('[id^="theory-"], [id^="practical-"], [id^="video-"]').forEach(g => g.classList.add('hidden'));
    document.getElementById(targetId).classList.remove('hidden');
}

// --- RENDER EXAM SLOT ---
function renderExamSlot(semester, unitCode, type, label, papers, mode) {
    const paper = papers.find(p => p.unitCode === unitCode && p.type === type && p.mode === mode);

    if (paper) {
        return `
      <div class="bg-[var(--bg)] rounded-lg p-3 border border-[var(--border)]">
        <div class="flex items-center justify-between mb-2">
          <span class="type-badge ${type}">${label}</span>
          ${paper.score ? `<span class="text-xs text-[var(--accent)] font-mono">${paper.score}</span>` : ''}
        </div>
        <div class="paper-card mt-2" style="animation-delay: 0.1s">
          <div class="flex items-center gap-3">
            <div class="file-icon w-10 h-10 rounded bg-[var(--accent-dim)] flex items-center justify-center">
              ${paper.fileType === 'pdf' ? `
                <svg class="w-5 h-5 text-[var(--accent)]" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"/></svg>
              ` : `
                <svg class="w-5 h-5 text-[var(--accent)]" fill="currentColor" viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>
              `}
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm truncate">${paper.fileName}</p>
              <p class="text-xs text-[var(--muted)]">${formatFileSize(paper.fileSize)}</p>
            </div>
          </div>
          <div class="flex gap-2 mt-3">
            <button onclick="viewPaper('${paper.id}')" class="btn-secondary text-xs flex-1">View</button>
            <a href="${paper.fileUrl}" target="_blank" class="btn-secondary text-xs flex-1 text-center">Download</a>
          </div>
        </div>
      </div>`;
    } else {
        return `
      <div class="bg-[var(--bg)] rounded-lg p-3 border border-dashed border-[var(--border)]">
        <div class="flex items-center justify-between mb-2">
          <span class="type-badge ${type}">${label}</span>
        </div>
        <button onclick="quickUpload(${semester}, '${unitCode}', '${type}', '${mode}')" 
          class="w-full mt-2 py-4 border border-dashed border-[var(--border)] rounded-lg text-[var(--muted)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-all text-sm flex items-center justify-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
          Add
        </button>
      </div>`;
    }
}

// --- RENDER VIDEO SLOT ---
function renderVideoSlot(semester, unitCode, type, label, papers) {
    const paper = papers.find(p => p.unitCode === unitCode && p.type === type && p.mode === 'video');

    if (paper) {
        return `
      <div class="bg-[var(--bg)] rounded-lg p-3 border border-[var(--border)]">
        <div class="flex items-center justify-between mb-2">
          <span class="type-badge" style="background: rgba(138, 43, 226, 0.2); color: #da70d6;">${label}</span>
        </div>
        <div class="paper-card mt-2" style="animation-delay: 0.1s">
          <div class="flex items-center gap-3">
            <div class="file-icon w-10 h-10 rounded flex items-center justify-center" style="background: rgba(138, 43, 226, 0.15);">
                <svg class="w-5 h-5 text-purple-400" fill="currentColor" viewBox="0 0 24 24"><path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/></svg>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm truncate">${paper.fileName}</p>
              <p class="text-xs text-[var(--muted)]">${formatFileSize(paper.fileSize)}</p>
            </div>
          </div>
          <div class="flex gap-2 mt-3">
            <button onclick="viewPaper('${paper.id}')" class="btn-secondary text-xs flex-1">Play Video</button>
            <a href="${paper.fileUrl}" target="_blank" class="btn-secondary text-xs flex-1 text-center">Download</a>
          </div>
        </div>
      </div>`;
    } else {
        return `
      <div class="bg-[var(--bg)] rounded-lg p-3 border border-dashed border-[var(--border)]">
        <div class="flex items-center justify-between mb-2">
          <span class="type-badge" style="background: rgba(138, 43, 226, 0.2); color: #da70d6;">${label}</span>
        </div>
        <button onclick="quickUpload(${semester}, '${unitCode}', '${type}', 'video')" 
          class="w-full mt-2 py-4 border border-dashed border-[var(--border)] rounded-lg text-[var(--muted)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-all text-sm flex items-center justify-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
          Add Video
        </button>
      </div>`;
    }
}

// --- VIEW PAPER ---
function viewPaper(id) {
    const paper = papers.find(p => p.id === id);
    if (!paper) return;

    const modal = document.getElementById('viewModal');
    const title = document.getElementById('viewTitle');
    const content = document.getElementById('viewContent');

    title.textContent = `${paper.unitCode} - ${paper.type.toUpperCase()} (${paper.mode})`;

    if (paper.fileType === 'pdf') {
        content.innerHTML = `<iframe src="${paper.fileUrl}" class="w-full h-96 rounded-lg"></iframe>
      <div class="mt-4 flex gap-3"><a href="${paper.fileUrl}" target="_blank" class="btn-primary flex-1 text-center">Open PDF</a><button onclick="closeViewModal()" class="btn-secondary flex-1">Close</button></div>`;
    } else if (paper.fileType === 'video') {
        content.innerHTML = `<video controls class="w-full rounded-lg max-h-96"><source src="${paper.fileUrl}" type="${paper.fileMimeType || 'video/mp4'}">Your browser does not support the video tag.</video>
      <div class="mt-4 flex gap-3"><a href="${paper.fileUrl}" target="_blank" class="btn-primary flex-1 text-center">Download Video</a><button onclick="closeViewModal()" class="btn-secondary flex-1">Close</button></div>`;
    } else {
        content.innerHTML = `<img src="${paper.fileData || paper.fileUrl}" alt="${paper.fileName}" class="w-full rounded-lg">
      <div class="mt-4 flex gap-3"><a href="${paper.fileUrl}" target="_blank" class="btn-primary flex-1 text-center">Open Image</a><button onclick="closeViewModal()" class="btn-secondary flex-1">Close</button></div>`;
    }
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function quickUpload(semester, unitCode, type, mode) {
    if (!currentUser) return alert("Please login to upload papers.");
    openUploadModal();
    document.getElementById('uploadSemester').value = semester;
    populateUnits();
    setTimeout(() => {
        document.getElementById('uploadUnitCode').value = unitCode;
        document.getElementById('uploadType').value = type;
        document.getElementById('uploadMode').value = mode;
    }, 100);
}

function openUploadModal() {
    document.getElementById('uploadModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeUploadModal() {
    document.getElementById('uploadModal').classList.remove('active');
    document.body.style.overflow = '';
    resetForm();
}

function closeModalOnOverlay(event) {
    if (event.target === event.currentTarget) closeUploadModal();
}

function resetForm() {
    document.getElementById('uploadForm').reset();
    document.getElementById('fileLabel').textContent = 'Drag & drop or click to select';
    selectedFile = null;
    document.getElementById('uploadUnitCode').innerHTML = '<option value="">Select Module First</option>';
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'video/mp4', 'video/quicktime', 'video/x-msvideo'];
        if (!validTypes.includes(file.type)) {
            alert('Please select a valid file (PDF, Image, or Video)');
            return;
        }
        if (file.size > 20 * 1024 * 1024) { alert('File size must be less than 20MB'); return; }
        selectedFile = file;
        document.getElementById('fileLabel').textContent = file.name;
    }
}

function updateStats() {
    document.getElementById('totalPapers').textContent = papers.length;
    const uniqueUnits = new Set(papers.map(p => p.unitCode));
    document.getElementById('totalUnits').textContent = uniqueUnits.size;
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024; const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'fixed bottom-4 right-4 bg-[var(--accent)] text-[var(--bg)] px-6 py-3 rounded-lg font-semibold z-50 animate-pulse';
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => { notification.style.opacity = '0'; notification.style.transition = 'opacity 0.3s ease'; setTimeout(() => notification.remove(), 300); }, 2000);
}

function closeViewModal() {
    document.getElementById('viewModal').classList.remove('active');
    document.body.style.overflow = '';
}

document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeUploadModal(); closeViewModal(); } });