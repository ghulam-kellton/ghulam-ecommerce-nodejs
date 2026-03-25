const mongoose = require('mongoose');
const argon2 = require('argon2');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: { type: String, required: true, minlength: 8, select: false },
    role: {
        type: String,
        enum: ['customer', 'admin'],
        default: 'customer'
    },
    active: { type: Boolean, default: true }
}, { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await argon2.hash(this.password);
    next();
});

// Instance method to check password
userSchema.methods.correctPassword = async function (candidatePassword, userPassword) {
    return await argon2.verify(userPassword, candidatePassword);
};

module.exports = mongoose.model('User', userSchema);