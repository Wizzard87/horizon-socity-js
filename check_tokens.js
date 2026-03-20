import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config({ path: 'd:/x-clone-rn-master/x-clone-rn-master/backend/.env' });

const uri = process.env.MONGO_URI;

mongoose.connect(uri).then(async () => {
  const users = mongoose.connection.collection('users');
  const tokens = await users.find({ pushToken: { $exists: true, $ne: '' } }).toArray();
  console.log("Tokens found:", tokens.length);
  if (tokens.length > 0) {
    console.log("First token:", tokens[0].pushToken);
    console.log("clerkId:", tokens[0].clerkId);
  }
  process.exit(0);
}).catch(console.error);
