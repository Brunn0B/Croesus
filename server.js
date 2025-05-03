// server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();

// Configurações do ambiente
const {
  PORT = 3000,
  MONGODB_URI,
  JWT_SECRET,
  MASTER_PASSWORD = 'Croesus@123',
  SESSION_TIMEOUT = '8h',
  LOGIN_ATTEMPTS_LIMIT = 5
} = process.env;

// Verificação de variáveis de ambiente obrigatórias
if (!MONGODB_URI) {
  console.error('Erro: MONGODB_URI não definida no arquivo .env');
  process.exit(1);
}

if (!JWT_SECRET) {
  console.error('Erro: JWT_SECRET não definida no arquivo .env');
  process.exit(1);
}

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Definição dos Schemas do Mongoose
const AccessRequestSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    email: { type: String, required: true },
    company: { type: String, required: true },
    position: { type: String, required: true },
    reason: { type: String, required: true },
    status: { 
        type: String, 
        enum: ['pending', 'approved', 'rejected'], 
        default: 'pending' 
    },
    reviewedBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    },
    reviewedAt: { type: Date },
    createdAt: { type: Date, default: Date.now }
});

const UserSchema = new mongoose.Schema({
    username: { 
        type: String, 
        required: true, 
        unique: true,
        trim: true,
        minlength: 3,
        maxlength: 20
    },
    password: { 
        type: String, 
        required: true,
        minlength: 6
    },
    fullName: { 
        type: String, 
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    role: { 
        type: String, 
        enum: ['admin', 'manager', 'user'], 
        default: 'user' 
    },
    photo: {
        type: String,
        default: ''
    },
    lastLogin: { type: Date },
    loginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },
    createdAt: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date }
});

const ProductSchema = new mongoose.Schema({
    code: { 
        type: String, 
        required: true, 
        unique: true 
    },
    name: { 
        type: String, 
        required: true 
    },
    description: { 
        type: String, 
        default: '' 
    },
    barcode: { 
        type: String, 
        unique: true 
    },
    category: { 
        type: String, 
        default: 'Geral' 
    },
    unit: { 
        type: String, 
        default: 'un' 
    },
    minStock: { 
        type: Number, 
        default: 0 
    },
    maxStock: { 
        type: Number, 
        default: 100 
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    },
    updatedAt: { 
        type: Date, 
        default: Date.now 
    }
});

const SupplierSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true 
    },
    code: { 
        type: String, 
        required: true, 
        unique: true 
    },
    contact: { 
        type: String 
    },
    email: { 
        type: String 
    },
    phone: { 
        type: String 
    },
    address: { 
        type: String 
    },
    documents: {
        cnpj: { 
            type: String 
        },
        ie: { 
            type: String 
        }
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    }
});

const WarehouseSectionSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true 
    },
    code: { 
        type: String, 
        required: true, 
        unique: true 
    },
    description: { 
        type: String 
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    }
});

const AisleSchema = new mongoose.Schema({
    sectionId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'WarehouseSection', 
        required: true 
    },
    name: { 
        type: String, 
        required: true 
    },
    code: { 
        type: String, 
        required: true 
    },
    shelves: { 
        type: Number, 
        required: true, 
        min: 1 
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    }
});

const InventoryItemSchema = new mongoose.Schema({
    productId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Product', 
        required: true 
    },
    aisleId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Aisle', 
        required: true 
    },
    shelf: { 
        type: String, 
        required: true 
    },
    quantity: { 
        type: Number, 
        required: true, 
        min: 0 
    },
    batch: { 
        type: String 
    },
    expiryDate: { 
        type: Date 
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    },
    updatedAt: { 
        type: Date, 
        default: Date.now 
    }
});

const ReceivingSchema = new mongoose.Schema({
    invoiceNumber: { 
        type: String, 
        required: true 
    },
    supplierId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Supplier', 
        required: true 
    },
    status: { 
        type: String, 
        enum: ['pending', 'received', 'contested', 'canceled'], 
        default: 'pending' 
    },
    notes: { 
        type: String 
    },
    createdBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    },
    updatedAt: { 
        type: Date, 
        default: Date.now 
    }
});

const ReceivingItemSchema = new mongoose.Schema({
    receivingId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Receiving', 
        required: true 
    },
    productId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Product', 
        required: true 
    },
    expectedQty: { 
        type: Number, 
        required: true, 
        min: 1 
    },
    receivedQty: { 
        type: Number, 
        required: true, 
        min: 0 
    },
    status: { 
        type: String, 
        enum: ['pending', 'received', 'missing', 'excess', 'contested'], 
        default: 'pending' 
    },
    contested: { 
        type: Boolean, 
        default: false 
    },
    contestReason: { 
        type: String 
    },
    contestDescription: { 
        type: String 
    },
    contestPhotos: [{ 
        type: String 
    }]
});

const OrderSchema = new mongoose.Schema({
    orderNumber: { 
        type: String, 
        required: true, 
        unique: true 
    },
    clientId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Client' 
    },
    status: { 
        type: String, 
        enum: ['pending', 'picking', 'ready', 'shipped', 'delivered', 'canceled'], 
        default: 'pending' 
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    },
    updatedAt: { 
        type: Date, 
        default: Date.now 
    }
});

const OrderItemSchema = new mongoose.Schema({
    orderId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Order', 
        required: true 
    },
    productId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Product', 
        required: true 
    },
    quantity: { 
        type: Number, 
        required: true, 
        min: 1 
    },
    pickedQty: { 
        type: Number, 
        default: 0 
    },
    status: { 
        type: String, 
        enum: ['pending', 'partial', 'complete'], 
        default: 'pending' 
    }
});

const CarrierSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true 
    },
    code: { 
        type: String, 
        required: true, 
        unique: true 
    },
    contact: { 
        type: String 
    },
    email: { 
        type: String 
    },
    phone: { 
        type: String 
    },
    service: { 
        type: String 
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    }
});

const DeliverySchema = new mongoose.Schema({
    orderId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Order', 
        required: true 
    },
    carrierId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Carrier', 
        required: true 
    },
    trackingNumber: { 
        type: String, 
        required: true 
    },
    nfeNumber: { 
        type: String 
    },
    nfeKey: { 
        type: String 
    },
    status: { 
        type: String, 
        enum: ['preparing', 'ready', 'shipped', 'delivered'], 
        default: 'preparing' 
    },
    shippedAt: { 
        type: Date 
    },
    deliveredAt: { 
        type: Date 
    },
    createdBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    }
});

// Middleware para hash da senha antes de salvar
UserSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

// Método para comparar senhas
UserSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Método para incrementar tentativas de login
UserSchema.methods.incrementLoginAttempts = function() {
    if (this.lockUntil && this.lockUntil > Date.now()) return;
    
    this.loginAttempts += 1;
    
    if (this.loginAttempts >= LOGIN_ATTEMPTS_LIMIT) {
        this.lockUntil = Date.now() + 30 * 60 * 1000; // Bloqueia por 30 minutos
    }
    
    return this.save();
};

// Resetar tentativas de login após login bem-sucedido
UserSchema.methods.resetLoginAttempts = function() {
    this.loginAttempts = 0;
    this.lockUntil = undefined;
    return this.save();
};

// Criar índices para melhorar buscas
ProductSchema.index({ name: 'text', code: 'text', barcode: 'text' });
AisleSchema.index({ sectionId: 1, code: 1 }, { unique: true });
InventoryItemSchema.index({ productId: 1, aisleId: 1, shelf: 1 }, { unique: true });

// Criar modelos
const AccessRequest = mongoose.model('AccessRequest', AccessRequestSchema);
const User = mongoose.model('User', UserSchema);
const Product = mongoose.model('Product', ProductSchema);
const Supplier = mongoose.model('Supplier', SupplierSchema);
const WarehouseSection = mongoose.model('WarehouseSection', WarehouseSectionSchema);
const Aisle = mongoose.model('Aisle', AisleSchema);
const InventoryItem = mongoose.model('InventoryItem', InventoryItemSchema);
const Receiving = mongoose.model('Receiving', ReceivingSchema);
const ReceivingItem = mongoose.model('ReceivingItem', ReceivingItemSchema);
const Order = mongoose.model('Order', OrderSchema);
const OrderItem = mongoose.model('OrderItem', OrderItemSchema);
const Carrier = mongoose.model('Carrier', CarrierSchema);
const Delivery = mongoose.model('Delivery', DeliverySchema);

// Conexão com MongoDB
mongoose.connect(MONGODB_URI)
.then(() => console.log('Conectado ao MongoDB com sucesso'))
.catch(err => {
    console.error('Erro ao conectar ao MongoDB:', err);
    process.exit(1);
});

// Middleware de autenticação
const authenticate = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ 
                success: false,
                message: 'Acesso não autorizado. Token não fornecido.' 
            });
        }
        
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findOne({ _id: decoded.userId, isActive: true });
        
        if (!user) {
            return res.status(401).json({ 
                success: false,
                message: 'Usuário não encontrado ou conta desativada.' 
            });
        }
        
        req.user = user;
        req.token = token;
        next();
    } catch (error) {
        res.status(401).json({ 
            success: false,
            message: 'Sessão inválida ou expirada. Faça login novamente.' 
        });
    }
};

// Middleware para verificar permissões
const requireRole = (roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Acesso negado. Permissões insuficientes para esta ação.'
            });
        }
        next();
    };
};

// Limitar taxa de requisições
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100 // limite de 100 requisições por IP
});
app.use('/api/', limiter);

// Rotas de Autenticação
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Validação básica
        if (!username || !password) {
            return res.status(400).json({ 
                success: false,
                message: 'Nome de usuário e senha são obrigatórios.'
            });
        }

        // Busca o usuário
        const user = await User.findOne({ username, isActive: true });
        if (!user) {
            return res.status(401).json({ 
                success: false,
                message: 'Credenciais inválidas. Verifique seu nome de usuário.',
                field: 'username'
            });
        }

        // Verifica se a conta está bloqueada
        if (user.lockUntil && user.lockUntil > Date.now()) {
            const remainingTime = Math.ceil((user.lockUntil - Date.now()) / (60 * 1000));
            return res.status(403).json({ 
                success: false,
                message: `Conta temporariamente bloqueada. Tente novamente em ${remainingTime} minutos.`,
                field: 'username'
            });
        }

        // Verifica a senha
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            await user.incrementLoginAttempts();
            
            const remainingAttempts = LOGIN_ATTEMPTS_LIMIT - user.loginAttempts;
            let message = 'Credenciais inválidas. Verifique sua senha.';
            
            if (remainingAttempts <= 3) {
                message += ` (${remainingAttempts} tentativas restantes)`;
            }
            
            return res.status(401).json({ 
                success: false,
                message: message,
                field: 'password'
            });
        }

        // Login bem-sucedido - reseta tentativas
        await user.resetLoginAttempts();
        
        // Atualiza último login
        user.lastLogin = new Date();
        await user.save();

        // Cria token JWT
        const token = jwt.sign(
            { 
                userId: user._id,
                username: user.username,
                role: user.role
            },
            JWT_SECRET,
            { expiresIn: SESSION_TIMEOUT }
        );

        res.json({ 
            success: true,
            token,
            user: {
                id: user._id,
                username: user.username,
                fullName: user.fullName,
                email: user.email,
                role: user.role,
                photo: user.photo
            }
        });
    } catch (error) {
        console.error('Erro no processo de login:', error);
        res.status(500).json({ 
            success: false,
            message: 'Erro interno no servidor durante o login.' 
        });
    }
});

app.get('/api/user', authenticate, async (req, res) => {
    try {
        res.json({
            success: true,
            user: {
                id: req.user._id,
                username: req.user.username,
                fullName: req.user.fullName,
                email: req.user.email,
                role: req.user.role,
                photo: req.user.photo
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Erro ao carregar dados do usuário.'
        });
    }
});

// Rotas do Módulo de Logística
const logisticsRouter = express.Router();
app.use('/api/logistics', authenticate, logisticsRouter);

// Rotas de Produtos
logisticsRouter.get('/products', async (req, res) => {
    try {
        const { search, limit = 10, page = 1 } = req.query;
        const query = {};
        
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { code: { $regex: search, $options: 'i' } },
                { barcode: { $regex: search, $options: 'i' } }
            ];
        }
        
        const products = await Product.find(query)
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit))
            .sort({ name: 1 });
            
        const total = await Product.countDocuments(query);
        
        res.json({
            success: true,
            data: products,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit))
        });
    } catch (error) {
        console.error('Erro ao buscar produtos:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar produtos no banco de dados.'
        });
    }
});

logisticsRouter.get('/products/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Produto não encontrado com o ID fornecido.'
            });
        }
        
        res.json({
            success: true,
            data: product
        });
    } catch (error) {
        console.error('Erro ao buscar detalhes do produto:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar detalhes do produto.'
        });
    }
});

logisticsRouter.post('/products', requireRole(['admin', 'manager']), async (req, res) => {
    try {
        const { code, name, description, barcode, category, unit, minStock, maxStock } = req.body;
        
        // Validação básica
        if (!code || !name) {
            return res.status(400).json({
                success: false,
                message: 'Código e nome do produto são obrigatórios.',
                fields: {
                    code: !code ? 'Código é obrigatório' : undefined,
                    name: !name ? 'Nome é obrigatório' : undefined
                }
            });
        }
        
        // Verifica se código já existe
        const existingCode = await Product.findOne({ code });
        if (existingCode) {
            return res.status(400).json({
                success: false,
                message: 'Código já está em uso por outro produto.',
                field: 'code'
            });
        }
        
        // Verifica se código de barras já existe (se fornecido)
        if (barcode) {
            const existingBarcode = await Product.findOne({ barcode });
            if (existingBarcode) {
                return res.status(400).json({
                    success: false,
                    message: 'Código de barras já está em uso por outro produto.',
                    field: 'barcode'
                });
            }
        }
        
        // Cria o novo produto
        const product = new Product({
            code,
            name,
            description: description || '',
            barcode: barcode || `INTERNO-${code}`,
            category: category || 'Geral',
            unit: unit || 'un',
            minStock: minStock || 0,
            maxStock: maxStock || 100
        });
        
        await product.save();
        
        res.status(201).json({
            success: true,
            data: product,
            message: 'Produto cadastrado com sucesso.'
        });
    } catch (error) {
        console.error('Erro ao cadastrar produto:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao cadastrar novo produto no sistema.'
        });
    }
});

logisticsRouter.put('/products/:id', requireRole(['admin', 'manager']), async (req, res) => {
    try {
        const { code, name, description, barcode, category, unit, minStock, maxStock } = req.body;
        
        // Busca o produto existente
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Produto não encontrado para atualização.'
            });
        }
        
        // Verifica conflitos de código ou barcode
        if (code && code !== product.code) {
            const existingCode = await Product.findOne({ code });
            if (existingCode) {
                return res.status(400).json({
                    success: false,
                    message: 'Código já está em uso por outro produto.',
                    field: 'code'
                });
            }
        }
        
        if (barcode && barcode !== product.barcode) {
            const existingBarcode = await Product.findOne({ barcode });
            if (existingBarcode) {
                return res.status(400).json({
                    success: false,
                    message: 'Código de barras já está em uso por outro produto.',
                    field: 'barcode'
                });
            }
        }
        
        // Atualiza os campos
        product.code = code || product.code;
        product.name = name || product.name;
        product.description = description || product.description;
        product.barcode = barcode || product.barcode;
        product.category = category || product.category;
        product.unit = unit || product.unit;
        product.minStock = minStock || product.minStock;
        product.maxStock = maxStock || product.maxStock;
        product.updatedAt = new Date();
        
        await product.save();
        
        res.json({
            success: true,
            data: product,
            message: 'Produto atualizado com sucesso.'
        });
    } catch (error) {
        console.error('Erro ao atualizar produto:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao atualizar informações do produto.'
        });
    }
});

logisticsRouter.delete('/products/:id', requireRole(['admin', 'manager']), async (req, res) => {
    try {
        // Verifica se o produto existe
        const product = await Product.findByIdAndDelete(req.params.id);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Produto não encontrado para exclusão.'
            });
        }
        
        res.json({
            success: true,
            message: 'Produto excluído do sistema com sucesso.'
        });
    } catch (error) {
        console.error('Erro ao excluir produto:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao excluir produto do sistema.'
        });
    }
});

// Rotas de Fornecedores
logisticsRouter.get('/suppliers', async (req, res) => {
    try {
        const suppliers = await Supplier.find().sort({ name: 1 });
        res.json({
            success: true,
            data: suppliers
        });
    } catch (error) {
        console.error('Erro ao buscar fornecedores:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar lista de fornecedores.'
        });
    }
});

logisticsRouter.post('/suppliers', requireRole(['admin', 'manager']), async (req, res) => {
    try {
        const { name, code, contact, email, phone, address, documents } = req.body;
        
        // Validação básica
        if (!name || !code) {
            return res.status(400).json({
                success: false,
                message: 'Nome e código do fornecedor são obrigatórios.'
            });
        }
        
        // Verifica se fornecedor já existe
        const existingSupplier = await Supplier.findOne({ 
            $or: [{ name }, { code }] 
        });
        
        if (existingSupplier) {
            const conflictField = existingSupplier.name === name ? 'Nome' : 'Código';
            return res.status(400).json({
                success: false,
                message: `${conflictField} do fornecedor já está em uso.`,
                field: conflictField === 'Nome' ? 'name' : 'code'
            });
        }
        
        // Cria novo fornecedor
        const supplier = new Supplier({
            name,
            code,
            contact,
            email,
            phone,
            address,
            documents
        });
        
        await supplier.save();
        
        res.status(201).json({
            success: true,
            data: supplier,
            message: 'Fornecedor cadastrado com sucesso.'
        });
    } catch (error) {
        console.error('Erro ao cadastrar fornecedor:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao cadastrar novo fornecedor.'
        });
    }
});

// Rotas de Seções do Armazém
logisticsRouter.get('/sections', async (req, res) => {
    try {
        const sections = await WarehouseSection.find().sort({ name: 1 });
        res.json({
            success: true,
            data: sections
        });
    } catch (error) {
        console.error('Erro ao buscar seções do armazém:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar seções do armazém.'
        });
    }
});

logisticsRouter.post('/sections', requireRole(['admin', 'manager']), async (req, res) => {
    try {
        const { name, code, description } = req.body;
        
        // Validação básica
        if (!name || !code) {
            return res.status(400).json({
                success: false,
                message: 'Nome e código da seção são obrigatórios.'
            });
        }
        
        // Verifica se seção já existe
        const existingSection = await WarehouseSection.findOne({ 
            $or: [{ name }, { code }] 
        });
        
        if (existingSection) {
            const conflictField = existingSection.name === name ? 'Nome' : 'Código';
            return res.status(400).json({
                success: false,
                message: `${conflictField} da seção já está em uso.`,
                field: conflictField === 'Nome' ? 'name' : 'code'
            });
        }
        
        // Cria nova seção
        const section = new WarehouseSection({
            name,
            code,
            description
        });
        
        await section.save();
        
        res.status(201).json({
            success: true,
            data: section,
            message: 'Seção do armazém criada com sucesso.'
        });
    } catch (error) {
        console.error('Erro ao criar seção do armazém:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao criar nova seção no armazém.'
        });
    }
});

// Rotas de Corredores
logisticsRouter.get('/aisles', async (req, res) => {
    try {
        const { sectionId } = req.query;
        const query = sectionId ? { sectionId } : {};
        
        const aisles = await Aisle.find(query)
            .populate('sectionId', 'name code')
            .sort({ name: 1 });
            
        res.json({
            success: true,
            data: aisles
        });
    } catch (error) {
        console.error('Erro ao buscar corredores:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar corredores do armazém.'
        });
    }
});

logisticsRouter.post('/aisles', requireRole(['admin', 'manager']), async (req, res) => {
    try {
        const { sectionId, name, shelves } = req.body;
        
        // Validação completa
        const errors = {};
        if (!sectionId) errors.sectionId = 'Seção é obrigatória';
        if (!name?.trim()) errors.name = 'Nome é obrigatório';
        if (!shelves || isNaN(shelves)) errors.shelves = 'Número de prateleiras inválido';
        else if (shelves < 1) errors.shelves = 'Deve ter pelo menos 1 prateleira';
        
        if (Object.keys(errors).length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Erro de validação',
                errors
            });
        }
        
        // Verifica se a seção existe
        const section = await WarehouseSection.findById(sectionId);
        if (!section) {
            return res.status(404).json({
                success: false,
                message: 'Seção não encontrada'
            });
        }
        
        // Verifica se corredor já existe
        const existingAisle = await Aisle.findOne({ 
            sectionId,
            name 
        });
        
        if (existingAisle) {
            return res.status(400).json({
                success: false,
                message: 'Já existe um corredor com este nome na seção selecionada',
                field: 'name'
            });
        }
        
        // Cria o corredor
        const aisle = new Aisle({
            sectionId,
            name,
            shelves
        });
        
        await aisle.save();
        
        res.status(201).json({
            success: true,
            data: aisle,
            message: 'Corredor criado com sucesso'
        });
    } catch (error) {
        console.error('Erro ao criar corredor:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao criar corredor'
        });
    }
});

// Rotas de Itens de Estoque
logisticsRouter.get('/inventory', async (req, res) => {
    try {
        const { productId, aisleId, shelf } = req.query;
        const query = {};
        
        if (productId) query.productId = productId;
        if (aisleId) query.aisleId = aisleId;
        if (shelf) query.shelf = shelf;
        
        const items = await InventoryItem.find(query)
            .populate('productId', 'name code')
            .populate('aisleId', 'name code sectionId')
            .sort({ shelf: 1 });
            
        res.json({
            success: true,
            data: items
        });
    } catch (error) {
        console.error('Erro ao buscar itens de estoque:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar itens no estoque.'
        });
    }
});

logisticsRouter.post('/inventory', requireRole(['admin', 'manager']), async (req, res) => {
    try {
        const { productId, aisleId, shelf, quantity, batch, expiryDate } = req.body;
        
        // Validação básica
        if (!productId || !aisleId || !shelf || !quantity) {
            return res.status(400).json({
                success: false,
                message: 'Produto, corredor, prateleira e quantidade são obrigatórios.'
            });
        }
        
        // Verifica se o produto existe
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Produto não encontrado.'
            });
        }
        
        // Verifica se o corredor existe
        const aisle = await Aisle.findById(aisleId);
        if (!aisle) {
            return res.status(404).json({
                success: false,
                message: 'Corredor não encontrado.'
            });
        }
        
        // Verifica se o item já existe no mesmo local
        const existingItem = await InventoryItem.findOne({ 
            productId,
            aisleId,
            shelf 
        });
        
        if (existingItem) {
            return res.status(400).json({
                success: false,
                message: 'Este produto já está cadastrado nesta prateleira.'
            });
        }
        
        // Cria novo item de estoque
        const item = new InventoryItem({
            productId,
            aisleId,
            shelf,
            quantity,
            batch,
            expiryDate
        });
        
        await item.save();
        
        res.status(201).json({
            success: true,
            data: item,
            message: 'Item adicionado ao estoque com sucesso.'
        });
    } catch (error) {
        console.error('Erro ao adicionar item ao estoque:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao adicionar novo item ao estoque.'
        });
    }
});

logisticsRouter.put('/inventory/:id', requireRole(['admin', 'manager']), async (req, res) => {
    try {
        const { quantity, batch, expiryDate } = req.body;
        
        // Busca o item existente
        const item = await InventoryItem.findById(req.params.id)
            .populate('productId', 'name code')
            .populate('aisleId', 'name code');
            
        if (!item) {
            return res.status(404).json({
                success: false,
                message: 'Item de estoque não encontrado.'
            });
        }
        
        // Validação da quantidade
        if (quantity !== undefined) {
            if (isNaN(quantity)) {  // <-- Aqui estava o erro de sintaxe (parêntese extra)
                return res.status(400).json({
                    success: false,
                    message: 'Quantidade deve ser um número válido.',
                    field: 'quantity'
                });
            }
            
            if (quantity < 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Quantidade não pode ser negativa.',
                    field: 'quantity'
                });
            }
        }
        
        // Validação da data de validade
        if (expiryDate && new Date(expiryDate) < new Date()) {
            return res.status(400).json({
                success: false,
                message: 'Data de validade não pode ser no passado.',
                field: 'expiryDate'
            });
        }
        
        // Atualiza os campos
        if (quantity !== undefined) item.quantity = quantity;
        if (batch !== undefined) item.batch = batch;
        if (expiryDate !== undefined) item.expiryDate = expiryDate;
        
        item.updatedAt = new Date();
        
        await item.save();
        
        // Busca informações completas para retornar
        const updatedItem = await InventoryItem.findById(item._id)
            .populate('productId', 'name code')
            .populate('aisleId', 'name code sectionId');
        
        res.json({
            success: true,
            data: updatedItem,
            message: 'Item de estoque atualizado com sucesso.'
        });
    } catch (error) {
        console.error('Erro ao atualizar item de estoque:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao atualizar item de estoque.',
            error: error.message
        });
    }
});

logisticsRouter.get('/receivings', async (req, res) => {
    try {
        const { status, supplierId, startDate, endDate } = req.query;
        const query = {};
        
        if (status) query.status = status;
        if (supplierId) query.supplierId = supplierId;
        
        // Filtro por data
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }
        
        const receivings = await Receiving.find(query)
            .populate('supplierId', 'name code')
            .populate('createdBy', 'username fullName')
            .sort({ createdAt: -1 });
            
        res.json({
            success: true,
            data: receivings
        });
    } catch (error) {
        console.error('Erro ao buscar recebimentos:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar histórico de recebimentos.'
        });
    }
});

logisticsRouter.post('/receivings', async (req, res) => {
    try {
        const { invoiceNumber, supplierId, notes } = req.body;
        
        // Validação básica
        if (!invoiceNumber || !supplierId) {
            return res.status(400).json({
                success: false,
                message: 'Número da nota fiscal e fornecedor são obrigatórios.'
            });
        }
        
        // Verifica se o fornecedor existe
        const supplier = await Supplier.findById(supplierId);
        if (!supplier) {
            return res.status(404).json({
                success: false,
                message: 'Fornecedor não encontrado.'
            });
        }
        
        // Cria novo recebimento
        const receiving = new Receiving({
            invoiceNumber,
            supplierId,
            notes,
            createdBy: req.user._id
        });
        
        await receiving.save();
        
        res.status(201).json({
            success: true,
            data: receiving,
            message: 'Recebimento registrado com sucesso. Adicione os itens recebidos.'
        });
    } catch (error) {
        console.error('Erro ao registrar recebimento:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao registrar novo recebimento.'
        });
    }
});

logisticsRouter.post('/receivings/:id/items', async (req, res) => {
    try {
        const { productId, expectedQty, receivedQty } = req.body;
        
        // Validação básica
        if (!productId || !expectedQty) {
            return res.status(400).json({
                success: false,
                message: 'Produto e quantidade esperada são obrigatórios.'
            });
        }
        
        // Verifica se o recebimento existe
        const receiving = await Receiving.findById(req.params.id);
        if (!receiving) {
            return res.status(404).json({
                success: false,
                message: 'Recebimento não encontrado.'
            });
        }
        
        // Verifica se o produto existe
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Produto não encontrado.'
            });
        }
        
        // Verifica se o item já foi adicionado
        const existingItem = await ReceivingItem.findOne({
            receivingId: req.params.id,
            productId
        });
        
        if (existingItem) {
            return res.status(400).json({
                success: false,
                message: 'Este produto já foi adicionado a este recebimento.'
            });
        }
        
        // Cria novo item de recebimento
        const item = new ReceivingItem({
            receivingId: req.params.id,
            productId,
            expectedQty,
            receivedQty: receivedQty || 0,
            status: receivedQty === expectedQty ? 'received' : 
                   (receivedQty > expectedQty ? 'excess' : 
                   (receivedQty > 0 ? 'missing' : 'pending'))
        });
        
        await item.save();
        
        res.status(201).json({
            success: true,
            data: item,
            message: 'Item adicionado ao recebimento com sucesso.'
        });
    } catch (error) {
        console.error('Erro ao adicionar item ao recebimento:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao adicionar item ao recebimento.'
        });
    }
});

logisticsRouter.put('/receivings/:id/items/:itemId', async (req, res) => {
    try {
        const { receivedQty, contestReason, contestDescription } = req.body;
        
        // Busca o item existente
        const item = await ReceivingItem.findOne({
            _id: req.params.itemId,
            receivingId: req.params.id
        }).populate('productId', 'name code');
        
        if (!item) {
            return res.status(404).json({
                success: false,
                message: 'Item de recebimento não encontrado.'
            });
        }
        
        // Atualiza a quantidade recebida
        if (receivedQty !== undefined) {
            item.receivedQty = receivedQty;
            
            // Atualiza o status
            if (receivedQty === item.expectedQty) {
                item.status = 'received';
                item.contested = false;
            } else if (receivedQty > item.expectedQty) {
                item.status = 'excess';
            } else if (receivedQty > 0) {
                item.status = 'missing';
            } else {
                item.status = 'pending';
            }
        }
        
        // Atualiza contestação se fornecida
        if (contestReason || contestDescription) {
            item.contested = true;
            item.contestReason = contestReason || item.contestReason;
            item.contestDescription = contestDescription || item.contestDescription;
            item.status = 'contested';
        }
        
        await item.save();
        
        res.json({
            success: true,
            data: item,
            message: 'Item de recebimento atualizado com sucesso.'
        });
    } catch (error) {
        console.error('Erro ao atualizar item de recebimento:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao atualizar item de recebimento.'
        });
    }
});

logisticsRouter.post('/receivings/:id/confirm', async (req, res) => {
    try {
        // Busca o recebimento e seus itens
        const receiving = await Receiving.findById(req.params.id)
            .populate('supplierId', 'name code');
        
        if (!receiving) {
            return res.status(404).json({
                success: false,
                message: 'Recebimento não encontrado.'
            });
        }
        
        const items = await ReceivingItem.find({ receivingId: req.params.id })
            .populate('productId', 'name code');
            
        if (items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Adicione pelo menos um item antes de confirmar o recebimento.'
            });
        }
        
        // Verifica se há itens pendentes ou com divergência
        const hasPendingItems = items.some(item => 
            item.status === 'pending' || item.status === 'missing' || item.status === 'excess'
        );
        
        if (hasPendingItems) {
            return res.status(400).json({
                success: false,
                message: 'Existem itens com divergência ou pendentes. Verifique antes de confirmar.'
            });
        }
        
        // Atualiza o status do recebimento
        receiving.status = 'received';
        receiving.updatedAt = new Date();
        await receiving.save();
        
        // Atualiza o estoque para cada item recebido
        for (const item of items) {
            // Busca a localização padrão para este produto
            const inventoryItem = await InventoryItem.findOne({ productId: item.productId });
            
            if (inventoryItem) {
                // Se já existe no estoque, atualiza a quantidade
                inventoryItem.quantity += item.receivedQty;
                inventoryItem.updatedAt = new Date();
                await inventoryItem.save();
            } else {
                // Se não existe, cria um novo registro no estoque
                const defaultAisle = await Aisle.findOne().sort({ createdAt: 1 });
                
                if (defaultAisle) {
                    const newInventoryItem = new InventoryItem({
                        productId: item.productId,
                        aisleId: defaultAisle._id,
                        shelf: '1', // Prateleira padrão
                        quantity: item.receivedQty
                    });
                    
                    await newInventoryItem.save();
                }
            }
        }
        
        res.json({
            success: true,
            data: receiving,
            message: 'Recebimento confirmado com sucesso. Estoque atualizado.'
        });
    } catch (error) {
        console.error('Erro ao confirmar recebimento:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao confirmar recebimento e atualizar estoque.'
        });
    }
});

// Rotas de Pedidos
logisticsRouter.get('/orders', async (req, res) => {
    try {
        const { status, startDate, endDate } = req.query;
        const query = {};
        
        if (status) query.status = status;
        
        // Filtro por data
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }
        
        const orders = await Order.find(query)
            .sort({ createdAt: -1 });
            
        res.json({
            success: true,
            data: orders
        });
    } catch (error) {
        console.error('Erro ao buscar pedidos:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar histórico de pedidos.'
        });
    }
});

logisticsRouter.get('/orders/:id', async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('clientId', 'name code');
            
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Pedido não encontrado.'
            });
        }
        
        const items = await OrderItem.find({ orderId: req.params.id })
            .populate('productId', 'name code');
            
        res.json({
            success: true,
            data: {
                ...order.toObject(),
                items
            }
        });
    } catch (error) {
        console.error('Erro ao buscar detalhes do pedido:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar detalhes do pedido.'
        });
    }
});

logisticsRouter.post('/orders/:id/pick', async (req, res) => {
    try {
        const { items } = req.body;
        
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Informe os itens para separação.'
            });
        }
        
        // Busca o pedido
        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Pedido não encontrado.'
            });
        }
        
        // Atualiza cada item do pedido
        for (const itemData of items) {
            const item = await OrderItem.findOne({
                _id: itemData.itemId,
                orderId: req.params.id
            });
            
            if (item) {
                item.pickedQty = itemData.pickedQty;
                item.status = itemData.pickedQty === item.quantity ? 'complete' : 
                             (itemData.pickedQty > 0 ? 'partial' : 'pending');
                await item.save();
            }
        }
        
        // Verifica se todos os itens foram completamente separados
        const allItems = await OrderItem.find({ orderId: req.params.id });
        const allComplete = allItems.every(item => item.status === 'complete');
        
        // Atualiza o status do pedido
        order.status = allComplete ? 'ready' : 'picking';
        order.updatedAt = new Date();
        await order.save();
        
        res.json({
            success: true,
            data: order,
            message: 'Separação de pedido atualizada com sucesso.'
        });
    } catch (error) {
        console.error('Erro ao atualizar separação do pedido:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao atualizar separação do pedido.'
        });
    }
});

// Rotas de Transportadoras
logisticsRouter.get('/carriers', async (req, res) => {
    try {
        const carriers = await Carrier.find().sort({ name: 1 });
        res.json({
            success: true,
            data: carriers
        });
    } catch (error) {
        console.error('Erro ao buscar transportadoras:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar lista de transportadoras.'
        });
    }
});

// Rotas de Expedição
logisticsRouter.post('/orders/:id/ship', async (req, res) => {
    try {
        const { carrierId, trackingNumber, nfeNumber, nfeKey } = req.body;
        
        // Validação básica
        if (!carrierId || !trackingNumber) {
            return res.status(400).json({
                success: false,
                message: 'Transportadora e número de rastreio são obrigatórios.'
            });
        }
        
        // Busca o pedido
        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Pedido não encontrado.'
            });
        }
        
        // Verifica se o pedido está pronto para expedição
        if (order.status !== 'ready') {
            return res.status(400).json({
                success: false,
                message: 'O pedido não está pronto para expedição.'
            });
        }
        
        // Verifica se a transportadora existe
        const carrier = await Carrier.findById(carrierId);
        if (!carrier) {
            return res.status(404).json({
                success: false,
                message: 'Transportadora não encontrada.'
            });
        }
        
        // Cria registro de expedição
        const delivery = new Delivery({
            orderId: req.params.id,
            carrierId,
            trackingNumber,
            nfeNumber,
            nfeKey,
            status: 'shipped',
            shippedAt: new Date(),
            createdBy: req.user._id
        });
        
        await delivery.save();
        
        // Atualiza status do pedido
        order.status = 'shipped';
        order.updatedAt = new Date();
        await order.save();
        
        // Atualiza o estoque - reduz as quantidades dos itens
        const orderItems = await OrderItem.find({ orderId: req.params.id });
        
        for (const item of orderItems) {
            const inventoryItems = await InventoryItem.find({ productId: item.productId })
                .sort({ quantity: -1 });
                
            let remainingQty = item.quantity;
            
            for (const invItem of inventoryItems) {
                if (remainingQty <= 0) break;
                
                const deduction = Math.min(remainingQty, invItem.quantity);
                invItem.quantity -= deduction;
                remainingQty -= deduction;
                await invItem.save();
            }
            
            if (remainingQty > 0) {
                console.warn(`Não havia estoque suficiente para o produto ${item.productId}. Faltaram ${remainingQty} unidades.`);
            }
        }
        
        res.json({
            success: true,
            data: delivery,
            message: 'Pedido expedido com sucesso. Estoque atualizado.'
        });
    } catch (error) {
        console.error('Erro ao expedir pedido:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao expedir pedido.'
        });
    }
});

// Rota para relatório de estoque
logisticsRouter.get('/inventory/report', async (req, res) => {
    try {
        const { minStock, maxStock, category } = req.query;
        const query = {};
        
        if (minStock) query.quantity = { $gte: parseInt(minStock) };
        if (maxStock) {
            query.quantity = query.quantity || {};
            query.quantity.$lte = parseInt(maxStock);
        }
        
        // Se for filtro por categoria, primeiro busca os produtos
        let productFilter = {};
        if (category) productFilter.category = category;
        
        const products = await Product.find(productFilter);
        if (products.length > 0) {
            query.productId = { $in: products.map(p => p._id) };
        }
        
        const inventory = await InventoryItem.find(query)
            .populate('productId', 'name code category')
            .populate('aisleId', 'name code sectionId')
            .sort({ 'productId.name': 1 });
            
        res.json({
            success: true,
            data: inventory
        });
    } catch (error) {
        console.error('Erro ao gerar relatório de estoque:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao gerar relatório de estoque.'
        });
    }
});

// Rota para dashboard de estoque
logisticsRouter.get('/dashboard', async (req, res) => {
    try {
        // Contagem total de produtos
        const totalProducts = await Product.countDocuments();
        
        // Contagem de produtos com estoque baixo
        const lowStockProducts = await InventoryItem.aggregate([
            {
                $lookup: {
                    from: 'products',
                    localField: 'productId',
                    foreignField: '_id',
                    as: 'product'
                }
            },
            { $unwind: '$product' },
            {
                $group: {
                    _id: '$productId',
                    total: { $sum: '$quantity' },
                    minStock: { $first: '$product.minStock' },
                    name: { $first: '$product.name' }
                }
            },
            {
                $match: {
                    $expr: { $lt: ['$total', '$minStock'] }
                }
            }
        ]);
        
        // Valor total do estoque (simulação)
        const totalValue = await InventoryItem.aggregate([
            {
                $group: {
                    _id: null,
                    total: { $sum: '$quantity' }
                }
            }
        ]);
        
        // Seções com capacidade (simulação)
        const sections = await WarehouseSection.aggregate([
            {
                $lookup: {
                    from: 'aisles',
                    localField: '_id',
                    foreignField: 'sectionId',
                    as: 'aisles'
                }
            },
            {
                $project: {
                    name: 1,
                    code: 1,
                    aisleCount: { $size: '$aisles' },
                    shelfCount: { $sum: '$aisles.shelves' }
                }
            }
        ]);
        
        res.json({
            success: true,
            data: {
                totalProducts,
                lowStockCount: lowStockProducts.length,
                lowStockProducts,
                totalQuantity: totalValue[0]?.total || 0,
                sections
            }
        });
    } catch (error) {
        console.error('Erro ao buscar dados do dashboard:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar dados para o dashboard.'
        });
    }
});

// Rota para buscar localizações de um produto
logisticsRouter.get('/products/:id/locations', async (req, res) => {
    try {
        const inventoryItems = await InventoryItem.find({ productId: req.params.id })
            .populate('aisleId', 'name code sectionId')
            .sort({ quantity: -1 });
            
        if (inventoryItems.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Produto não encontrado no estoque.'
            });
        }
        
        res.json({
            success: true,
            data: inventoryItems
        });
    } catch (error) {
        console.error('Erro ao buscar localizações do produto:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar localizações do produto no estoque.'
        });
    }
});

// Rota para mover itens no estoque
logisticsRouter.post('/inventory/move', requireRole(['admin', 'manager']), async (req, res) => {
    try {
        const { itemId, newAisleId, newShelf, quantity } = req.body;
        
        // Validação básica
        if (!itemId || !newAisleId || !newShelf || !quantity) {
            return res.status(400).json({
                success: false,
                message: 'Item, novo local e quantidade são obrigatórios.'
            });
        }
        
        // Busca o item original
        const originalItem = await InventoryItem.findById(itemId)
            .populate('productId', 'name code');
            
        if (!originalItem) {
            return res.status(404).json({
                success: false,
                message: 'Item de estoque não encontrado.'
            });
        }
        
        // Verifica se há quantidade suficiente
        if (originalItem.quantity < quantity) {
            return res.status(400).json({
                success: false,
                message: 'Quantidade solicitada maior que a disponível no local de origem.'
            });
        }
        
        // Verifica se o novo corredor existe
        const newAisle = await Aisle.findById(newAisleId);
        if (!newAisle) {
            return res.status(404).json({
                success: false,
                message: 'Corredor de destino não encontrado.'
            });
        }
        
        // Verifica se já existe um item no destino
        let destinationItem = await InventoryItem.findOne({
            productId: originalItem.productId,
            aisleId: newAisleId,
            shelf: newShelf
        });
        
        if (destinationItem) {
            // Se existir, apenas atualiza a quantidade
            destinationItem.quantity += parseInt(quantity);
            await destinationItem.save();
        } else {
            // Se não existir, cria um novo item
            destinationItem = new InventoryItem({
                productId: originalItem.productId,
                aisleId: newAisleId,
                shelf: newShelf,
                quantity: parseInt(quantity)
            });
            
            await destinationItem.save();
        }
        
        // Atualiza o item original (reduz a quantidade)
        originalItem.quantity -= parseInt(quantity);
        
        if (originalItem.quantity <= 0) {
            // Se a quantidade zerou, remove o item
            await originalItem.remove();
        } else {
            await originalItem.save();
        }
        
        res.json({
            success: true,
            data: {
                from: originalItem,
                to: destinationItem
            },
            message: 'Item movido no estoque com sucesso.'
        });
    } catch (error) {
        console.error('Erro ao mover item no estoque:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao mover item no estoque.'
        });
    }
});

// Rota para histórico de movimentações
logisticsRouter.get('/inventory/history', requireRole(['admin', 'manager']), async (req, res) => {
    try {
        const { productId, startDate, endDate } = req.query;
        const query = {};
        
        if (productId) query.productId = productId;
        
        // Filtro por data
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }
        
        // Implementação básica - em produção seria mais completo
        const history = await InventoryItem.find(query)
            .populate('productId', 'name code')
            .populate('aisleId', 'name code')
            .sort({ updatedAt: -1 });
            
        res.json({
            success: true,
            data: history
        });
    } catch (error) {
        console.error('Erro ao buscar histórico de estoque:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar histórico de movimentações no estoque.'
        });
    }
});

// Rota para gerar código de barras (simulação)
logisticsRouter.get('/barcode/generate', async (req, res) => {
    try {
        const randomBarcode = Math.floor(1000000000000 + Math.random() * 9000000000000).toString();
        res.json({
            success: true,
            data: randomBarcode
        });
    } catch (error) {
        console.error('Erro ao gerar código de barras:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao gerar código de barras.'
        });
    }
});

// Rota para verificar código de barras
logisticsRouter.get('/barcode/check/:code', async (req, res) => {
    try {
        const product = await Product.findOne({ barcode: req.params.code });
        
        if (product) {
            res.json({
                success: true,
                exists: true,
                product: {
                    id: product._id,
                    name: product.name,
                    code: product.code
                }
            });
        } else {
            res.json({
                success: true,
                exists: false
            });
        }
    } catch (error) {
        console.error('Erro ao verificar código de barras:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao verificar código de barras.'
        });
    }
});

// Rota para upload de imagens (simulação para contestação)
logisticsRouter.post('/upload', requireRole(['admin', 'manager']), async (req, res) => {
    try {
        // Em produção, implementaria upload real com multer ou similar
        const { files } = req.body;
        
        if (!files || files.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Nenhum arquivo enviado.'
            });
        }
        
        // Simula URLs de arquivos enviados
        const fileUrls = files.map((_, index) => 
            `/uploads/contest_${Date.now()}_${index}.jpg`
        );
        
        res.json({
            success: true,
            data: fileUrls
        });
    } catch (error) {
        console.error('Erro ao processar upload:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao processar upload de arquivos.'
        });
    }
});







// Rotas para Primeiro Acesso
app.post('/api/first-access/verify-key', async (req, res) => {
    try {
        const { activationKey } = req.body;
        
        if (!activationKey) {
            return res.status(400).json({
                success: false,
                message: 'Chave de ativação é obrigatória'
            });
        }
        
        // Em produção, você validaria a chave no banco de dados
        // Aqui estamos usando uma chave fixa para exemplo
        const validKey = 'CROESUS-1234-5678-9012'; // Substitua por sua lógica de validação
        
        if (activationKey !== validKey) {
            return res.status(400).json({
                success: false,
                message: 'Chave de ativação inválida'
            });
        }
        
        res.json({
            success: true,
            message: 'Chave de ativação válida'
        });
    } catch (error) {
        console.error('Erro ao verificar chave de ativação:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao verificar chave de ativação'
        });
    }
});

app.post('/api/first-access/register', async (req, res) => {
    try {
        const { activationKey, username, password, email, fullName } = req.body;
        
        // Validações básicas
        if (!activationKey || !username || !password || !email || !fullName) {
            return res.status(400).json({
                success: false,
                message: 'Todos os campos são obrigatórios'
            });
        }
        
        // Verificar se a chave ainda é válida (pode ter expirado ou sido usada)
        const validKey = 'CROESUS-1234-5678-9012'; // Substitua por sua lógica de validação
        
        if (activationKey !== validKey) {
            return res.status(400).json({
                success: false,
                message: 'Chave de ativação inválida ou expirada'
            });
        }
        
        // Verificar se o usuário já existe
        const existingUser = await User.findOne({ 
            $or: [{ username }, { email }] 
        });
        
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Nome de usuário ou email já está em uso',
                field: existingUser.username === username ? 'username' : 'email'
            });
        }
        
        // Criar novo usuário
        const newUser = new User({
            username,
            password, // O middleware pre('save') vai fazer o hash
            fullName,
            email,
            role: 'user' // Definir a role apropriada
        });
        
        await newUser.save();
        
        // Em produção, você invalidaria a chave de ativação após o uso
        // await ActivationKey.findOneAndUpdate(
        //     { key: activationKey },
        //     { $set: { used: true, usedBy: newUser._id, usedAt: new Date() } }
        // );
        
        res.json({
            success: true,
            message: 'Cadastro realizado com sucesso'
        });
    } catch (error) {
        console.error('Erro ao registrar primeiro acesso:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao completar cadastro'
        });
    }
});

// Middleware para lidar com rotas não encontradas
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Rota não encontrada.'
    });
});

// Middleware para lidar com erros
app.use((err, req, res, next) => {
    console.error('Erro interno:', err);
    res.status(500).json({
        success: false,
        message: 'Erro interno no servidor.'
    });
});

// Inicia o servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log(`Acesse http://localhost:${PORT}`);
});