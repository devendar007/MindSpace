// backend/routes/posts.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Post = require('../models/Post');
const Sentiment = require('sentiment');
const multer = require('multer');
const sentiment = new Sentiment({
  language: 'en',
  vocabulary: {
    'happy': 4, 'great': 3, 'awesome': 5, 'love': 4, 'amazing': 4,
    'sad': -4, 'hate': -5, 'awful': -4, 'angry': -3, 'anxious': -3,
    'cool': 2, 'bad': -2, 'ugh': -2, 'lit': 3, 'stress': -3,
    'hope': 3, 'fear': -3, 'joy': 4, 'tired': -2, 'excited': 4,
  },
});

const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    const ext = file.mimetype.split('/')[1];
    cb(null, `${Date.now()}.${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

const getEmotionCategory = (score, content) => {
  const lowerContent = content.toLowerCase();
  if (score > 3) return 'happy';
  if (score > 1) return 'calm';
  if (score < -3) {
    if (lowerContent.includes('anxious') || lowerContent.includes('stress')) return 'anxious';
    if (lowerContent.includes('angry') || lowerContent.includes('hate')) return 'angry';
    return 'sad';
  }
  if (score < -1) return 'down';
  return 'neutral';
};

const getPersonalizedResponse = (emotion, content) => {
  const responses = {
    happy: [
      "Wow, your joy is contagious! Keep shining bright! 🌞",
      "Love seeing you so happy! What’s sparking this joy today?",
      "You’re on fire with positivity! Keep it up! 🔥"
    ],
    calm: [
      "You’ve got a peaceful vibe going—nice work staying grounded. 🌿",
      "Feeling calm is a win. How about a moment to savor it?",
      "Your chill energy is inspiring. Keep it flowing! 😌"
    ],
    sad: [
      "I’m sorry you’re feeling this way. Try a warm drink or a cozy blanket—it might help a bit. You’re not alone. 💙",
      "It’s okay to feel sad. Want to journal more or take a slow walk? I’m here with you.",
      "Tough days happen. How about some music to lift your spirits? You’ve got this. 🎶"
    ],
    anxious: [
      "Feeling anxious can be rough. Try breathing in for 4, out for 4—it’s a small reset. You’re stronger than you think! 🌬️",
      "I see that stress sneaking in. How about a quick stretch or a distraction like a funny video? I’ve got your back.",
      "Anxiety’s tough, but you’re tougher. Focus on one thing at a time—start small. You’ll get through this! 💪"
    ],
    angry: [
      "It’s okay to feel fired up. Try punching a pillow or scribbling it out—let it loose safely. I’m here. ✊",
      "Anger can be heavy. How about a quick cooldown with some deep breaths? You’ve got control.",
      "Sounds like something’s got you riled up. Want to vent more? I’m listening—no judgment."
    ],
    down: [
      "Feeling a bit low is normal. How about a small win—like making your bed? I’m rooting for you! 🌱",
      "I see you’re not at your best. Try a gentle stretch or a favorite snack—it might nudge you up. You’re enough.",
      "Rough patch, huh? Let’s take it slow—maybe a quiet moment with tea? I’m with you. ☕"
    ],
    neutral: [
      "Thanks for checking in! What’s one thing you’d like to feel today? Let’s aim for it together. 🌟",
      "Steady as you go! How about a quick mindfulness moment to recharge?",
      "All good here? If you need a boost, I’ve got ideas—maybe a walk or a fun meme? 😊"
    ]
  };

  const emotionResponses = responses[emotion] || responses.neutral;
  return emotionResponses[Math.floor(Math.random() * emotionResponses.length)]; // Randomize for variety
};

console.log('Posts route loaded');

// Create Post
router.post('/', auth, upload.single('media'), async (req, res) => {
  try {
    const { title, content } = req.body;
    const media = req.file ? `/uploads/${req.file.filename}` : null;
    const isVideo = req.file && req.file.mimetype.startsWith('video');
    console.log('Post request received:', { title, content, media, token: req.header('x-auth-token') });
    console.log('User from token:', req.user);

    if (!req.user || !req.user.id) {
      console.log('Auth failed - no user ID');
      return res.status(401).json({ msg: 'Authentication failed - no user ID' });
    }

    const analysis = sentiment.analyze(content || '');
    const emotionCategory = getEmotionCategory(analysis.score, content);
    const personalizedResponse = getPersonalizedResponse(emotionCategory, content);

    const newPost = new Post({
      title: title || '',
      content,
      image: media && !isVideo ? media : null,
      video: media && isVideo ? media : null,
      author: req.user.id,
      sentiment: analysis.score,
      sentimentCategory: emotionCategory, // Use richer category
      response: personalizedResponse,
    });

    await newPost.save();
    console.log('Post saved:', newPost);
    res.json(newPost);
  } catch (err) {
    console.error('Post creation failed:', err.message, err.stack);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// Get All Posts
router.get('/', async (req, res) => {
  try {
    const posts = await Post.find().populate('author', ['username']).sort({ date: -1 });
    res.json(posts);
  } catch (err) {
    console.error('Get posts error:', err.message);
    res.status(500).send('Server error');
  }
});

// Add Comment
router.post('/:id/comments', auth, async (req, res) => {
  try {
    const { content } = req.body;
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ msg: 'Post not found' });
    }
    const newComment = { content, author: req.user.id };
    post.comments.push(newComment);
    await post.save();
    res.json(newComment);
  } catch (err) {
    console.error('Comment error:', err.message);
    res.status(500).send('Server error');
  }
});

// Delete Post
router.delete('/:id', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ msg: 'Post not found' });
    }
    if (post.author.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Not authorized to delete this post' });
    }
    await Post.deleteOne({ _id: req.params.id });
    res.json({ msg: 'Post deleted' });
  } catch (err) {
    console.error('Delete error:', err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;