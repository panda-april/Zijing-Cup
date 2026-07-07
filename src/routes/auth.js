const { Router } = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');
const prisma = require('../db');

const router = Router();

// POST /api/users/register
router.post('/users/register', async (req, res) => {
  const { userName, password, role, rank, mainRole, intro } = req.body;
  try {
    if (!userName || !password) throw new Error('用户名和密码不能为空');
    const existing = await prisma.user.findUnique({ where: { UserName: userName } });
    if (existing) throw new Error('该用户名已被注册');

    const hashed = await bcrypt.hash(password, await bcrypt.genSalt(10));
    const newUser = await prisma.user.create({
      data: {
        UserName: userName,
        PasswordHash: hashed,
        UserRole: role || 'audience',
        Rank: rank || null,
        MainRole: mainRole || null,
        Intro: intro || null
      }
    });

    const { PasswordHash, ...safe } = newUser;
    return res.status(201).json({ success: true, message: '用户创建成功', data: safe });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

// POST /api/users/login
router.post('/users/login', async (req, res) => {
  const { userName, password } = req.body;
  try {
    if (!userName || !password) throw new Error('用户名和密码不能为空');
    const user = await prisma.user.findUnique({ where: { UserName: userName } });
    if (!user) throw new Error('用户不存在');

    const ok = await bcrypt.compare(password, user.PasswordHash);
    if (!ok) throw new Error('密码错误');

    const token = jwt.sign({ userId: user.UserID, role: user.UserRole }, JWT_SECRET, { expiresIn: '24h' });
    const { PasswordHash, ...safe } = user;
    return res.status(200).json({ success: true, message: '登录成功', data: safe, token });
  } catch (error) {
    return res.status(401).json({ success: false, error: error.message });
  }
});

module.exports = router;
