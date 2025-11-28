import streamlit as st
import hashlib
from datetime import datetime

# Page configuration
st.set_page_config(
    page_title="Healthcare Portal",
    page_icon="🏥",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# Custom CSS for beautiful styling
st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');
    
    * {
        font-family: 'Poppins', sans-serif;
    }
    
    .main {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        padding: 2rem;
    }
    
    .stApp {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    
    .welcome-container {
        max-width: 600px;
        margin: 0 auto;
        background: white;
        padding: 3rem;
        border-radius: 20px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        animation: slideIn 0.5s ease-out;
    }
    
    @keyframes slideIn {
        from {
            opacity: 0;
            transform: translateY(-20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    .welcome-title {
        text-align: center;
        color: #667eea;
        font-size: 2.5rem;
        font-weight: 700;
        margin-bottom: 0.5rem;
    }
    
    .welcome-subtitle {
        text-align: center;
        color: #666;
        font-size: 1.1rem;
        margin-bottom: 2rem;
    }
    
    .role-button {
        width: 100%;
        padding: 1.5rem;
        margin: 1rem 0;
        border: 2px solid #667eea;
        border-radius: 15px;
        background: white;
        color: #667eea;
        font-size: 1.1rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s ease;
    }
    
    .role-button:hover {
        background: #667eea;
        color: white;
        transform: translateY(-2px);
        box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
    }
    
    .role-button.active {
        background: #667eea;
        color: white;
    }
    
    .form-container {
        background: #f8f9fa;
        padding: 2rem;
        border-radius: 15px;
        margin-top: 2rem;
    }
    
    .stButton>button {
        width: 100%;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 0.75rem;
        border: none;
        border-radius: 10px;
        font-size: 1.1rem;
        font-weight: 600;
        transition: all 0.3s ease;
    }
    
    .stButton>button:hover {
        transform: translateY(-2px);
        box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
    }
    
    .stTextInput>div>div>input {
        border-radius: 10px;
        border: 2px solid #e0e0e0;
        padding: 0.75rem;
    }
    
    .stTextInput>div>div>input:focus {
        border-color: #667eea;
        box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }
    
    .stTextArea>div>div>textarea {
        border-radius: 10px;
        border: 2px solid #e0e0e0;
    }
    
    .stTextArea>div>div>textarea:focus {
        border-color: #667eea;
        box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }
    
    .success-message {
        background: #d4edda;
        color: #155724;
        padding: 1rem;
        border-radius: 10px;
        margin: 1rem 0;
        border-left: 4px solid #28a745;
    }
    
    .error-message {
        background: #f8d7da;
        color: #721c24;
        padding: 1rem;
        border-radius: 10px;
        margin: 1rem 0;
        border-left: 4px solid #dc3545;
    }
    
    .file-uploader {
        border: 2px dashed #667eea;
        border-radius: 10px;
        padding: 2rem;
        text-align: center;
    }
    </style>
""", unsafe_allow_html=True)

# Initialize session state
if 'authenticated' not in st.session_state:
    st.session_state.authenticated = False
if 'user_type' not in st.session_state:
    st.session_state.user_type = None
if 'user_email' not in st.session_state:
    st.session_state.user_email = None
if 'users_db' not in st.session_state:
    st.session_state.users_db = {}
if 'current_page' not in st.session_state:
    st.session_state.current_page = 'welcome'

def hash_password(password):
    """Hash password for security"""
    return hashlib.sha256(password.encode()).hexdigest()

def register_user(email, password, user_type, user_data):
    """Register a new user"""
    if email in st.session_state.users_db:
        return False, "Email already registered. Please login instead."
    
    hashed_password = hash_password(password)
    st.session_state.users_db[email] = {
        'password': hashed_password,
        'user_type': user_type,
        'user_data': user_data,
        'registered_date': datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }
    return True, "Registration successful!"

def login_user(email, password):
    """Authenticate user"""
    if email not in st.session_state.users_db:
        return False, "Email not found. Please register first."
    
    hashed_password = hash_password(password)
    if st.session_state.users_db[email]['password'] != hashed_password:
        return False, "Incorrect password. Please try again."
    
    return True, "Login successful!"

def welcome_page():
    """Welcome page with login/signup"""
    col1, col2, col3 = st.columns([1, 2, 1])
    
    with col2:
        st.markdown('<div class="welcome-container">', unsafe_allow_html=True)
        
        st.markdown('<h1 class="welcome-title">🏥 Healthcare Portal</h1>', unsafe_allow_html=True)
        st.markdown('<p class="welcome-subtitle">Your trusted healthcare companion</p>', unsafe_allow_html=True)
        
        # Tab selection
        auth_mode = st.radio(
            "",
            ["Login", "Sign Up"],
            horizontal=True,
            label_visibility="collapsed",
            key="auth_mode"
        )
        
        st.markdown('<div class="form-container">', unsafe_allow_html=True)
        
        if auth_mode == "Sign Up":
            # Role selection
            st.markdown("### 👤 Select Your Role")
            user_type = st.radio(
                "",
                ["Patient", "Doctor"],
                horizontal=True,
                label_visibility="collapsed",
                key="user_type_radio"
            )
            
            st.markdown("---")
            
            # Registration form
            st.markdown(f"### ✍️ Register as {user_type}")
            
            email = st.text_input("📧 Email Address", placeholder="your.email@example.com")
            password = st.text_input("🔒 Password", type="password", placeholder="Enter a strong password")
            confirm_password = st.text_input("🔒 Confirm Password", type="password", placeholder="Re-enter your password")
            
            if user_type == "Patient":
                st.markdown("#### Patient Information")
                name = st.text_input("👤 Full Name", placeholder="John Doe")
                contact = st.text_input("📱 Contact Number", placeholder="+1 234 567 8900")
                bio_data = st.text_area("📝 Bio Data", placeholder="Age, gender, medical history, allergies, etc.", height=100)
                
                if st.button("🚀 Sign Up", key="signup_btn"):
                    if not email or not password or not name or not contact or not bio_data:
                        st.error("⚠️ Please fill in all required fields.")
                    elif password != confirm_password:
                        st.error("⚠️ Passwords do not match. Please try again.")
                    elif len(password) < 6:
                        st.error("⚠️ Password must be at least 6 characters long.")
                    else:
                        user_data = {
                            'name': name,
                            'contact': contact,
                            'bio_data': bio_data
                        }
                        success, message = register_user(email, password, user_type, user_data)
                        if success:
                            st.success(f"✅ {message}")
                            st.balloons()
                            st.session_state.authenticated = True
                            st.session_state.user_type = user_type
                            st.session_state.user_email = email
                            st.session_state.current_page = 'dashboard'
                            st.rerun()
                        else:
                            st.error(f"❌ {message}")
            
            else:  # Doctor
                st.markdown("#### Doctor Information")
                name = st.text_input("👤 Full Name", placeholder="Dr. Jane Smith")
                contact = st.text_input("📱 Contact Number", placeholder="+1 234 567 8900")
                specialization = st.text_input("🎓 Specialization", placeholder="Cardiology, Neurology, etc.")
                license_number = st.text_input("🆔 Medical License Number", placeholder="MD-XXXXX")
                experience = st.number_input("💼 Years of Experience", min_value=0, max_value=50, value=0)
                bio = st.text_area("📝 Professional Bio", placeholder="Your professional background and expertise...", height=100)
                
                st.markdown("#### 📄 Proof of Education")
                st.markdown("Please upload your medical degree, license, or certification document.")
                proof_of_education = st.file_uploader(
                    "Upload Document (PDF, PNG, JPG)",
                    type=['pdf', 'png', 'jpg', 'jpeg'],
                    help="Upload a clear copy of your medical credentials"
                )
                
                if st.button("🚀 Sign Up", key="signup_btn"):
                    if not email or not password or not name or not contact or not specialization or not license_number or not bio:
                        st.error("⚠️ Please fill in all required fields.")
                    elif not proof_of_education:
                        st.error("⚠️ Please upload your proof of education.")
                    elif password != confirm_password:
                        st.error("⚠️ Passwords do not match. Please try again.")
                    elif len(password) < 6:
                        st.error("⚠️ Password must be at least 6 characters long.")
                    else:
                        # In a real app, you would save the file to storage
                        # For now, we'll just store the filename
                        user_data = {
                            'name': name,
                            'contact': contact,
                            'specialization': specialization,
                            'license_number': license_number,
                            'experience': experience,
                            'bio': bio,
                            'proof_of_education_filename': proof_of_education.name if proof_of_education else None
                        }
                        success, message = register_user(email, password, user_type, user_data)
                        if success:
                            st.success(f"✅ {message}")
                            st.balloons()
                            st.session_state.authenticated = True
                            st.session_state.user_type = user_type
                            st.session_state.user_email = email
                            st.session_state.current_page = 'dashboard'
                            st.rerun()
                        else:
                            st.error(f"❌ {message}")
        
        else:  # Login mode
            st.markdown("### 🔐 Login to Your Account")
            login_email = st.text_input("📧 Email Address", placeholder="your.email@example.com", key="login_email")
            login_password = st.text_input("🔒 Password", type="password", placeholder="Enter your password", key="login_password")
            
            if st.button("🚀 Login", key="login_btn"):
                if not login_email or not login_password:
                    st.error("⚠️ Please enter both email and password.")
                else:
                    success, message = login_user(login_email, login_password)
                    if success:
                        st.success(f"✅ {message}")
                        st.session_state.authenticated = True
                        st.session_state.user_type = st.session_state.users_db[login_email]['user_type']
                        st.session_state.user_email = login_email
                        st.session_state.current_page = 'dashboard'
                        st.balloons()
                        st.rerun()
                    else:
                        st.error(f"❌ {message}")
        
        st.markdown('</div>', unsafe_allow_html=True)
        st.markdown('</div>', unsafe_allow_html=True)

def dashboard_page():
    """Main dashboard (to be constructed later)"""
    st.markdown("""
        <style>
        .dashboard-header {
            background: white;
            padding: 2rem;
            border-radius: 15px;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
            margin-bottom: 2rem;
        }
        </style>
    """, unsafe_allow_html=True)
    
    user_data = st.session_state.users_db[st.session_state.user_email]['user_data']
    user_type = st.session_state.user_type
    
    # Logout button
    col1, col2 = st.columns([10, 1])
    with col2:
        if st.button("🚪 Logout"):
            st.session_state.authenticated = False
            st.session_state.user_type = None
            st.session_state.user_email = None
            st.session_state.current_page = 'welcome'
            st.rerun()
    
    st.markdown('<div class="dashboard-header">', unsafe_allow_html=True)
    st.markdown(f"# 👋 Welcome, {user_data.get('name', 'User')}!")
    st.markdown(f"### You are logged in as a **{user_type}**")
    st.markdown('</div>', unsafe_allow_html=True)
    
    # Placeholder for future dashboard content
    st.info("🏗️ Dashboard is under construction. More features coming soon!")
    
    # Display user info
    with st.expander("👤 View Your Profile Information", expanded=False):
        if user_type == "Patient":
            st.write(f"**Name:** {user_data.get('name', 'N/A')}")
            st.write(f"**Contact:** {user_data.get('contact', 'N/A')}")
            st.write(f"**Bio Data:** {user_data.get('bio_data', 'N/A')}")
        else:  # Doctor
            st.write(f"**Name:** {user_data.get('name', 'N/A')}")
            st.write(f"**Contact:** {user_data.get('contact', 'N/A')}")
            st.write(f"**Specialization:** {user_data.get('specialization', 'N/A')}")
            st.write(f"**License Number:** {user_data.get('license_number', 'N/A')}")
            st.write(f"**Experience:** {user_data.get('experience', 0)} years")
            st.write(f"**Bio:** {user_data.get('bio', 'N/A')}")
            st.write(f"**Proof of Education:** {user_data.get('proof_of_education_filename', 'N/A')}")

# Main app flow
def main():
    if st.session_state.current_page == 'welcome' or not st.session_state.authenticated:
        welcome_page()
    elif st.session_state.current_page == 'dashboard' and st.session_state.authenticated:
        dashboard_page()

if __name__ == "__main__":
    main()

