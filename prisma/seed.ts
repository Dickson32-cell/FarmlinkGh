import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding FarmLink Ghana...");

  // Create admin user
  // Login: phone + password → then an EMAIL code to ADMIN_EMAIL
  // (dicksonapam@gmail.com) must be entered before the admin session is minted.
  const adminPass = await bcrypt.hash("admin123", 10);
  const admin = await prisma.user.upsert({
    where: { phone: "0244000000" },
    update: {},
    create: { name: "FarmLink Admin", phone: "0244000000", password: adminPass, role: "admin", status: "approved" },
  });

  // Create farmer users
  const farmers = [
    { name: "Kofi Asante", phone: "0244111222", region: "Eastern", town: "Koforidua", farmSize: 5, mainCrops: "Maize, Cassava" },
    { name: "Ama Serwaa", phone: "0244222333", region: "Ashanti", town: "Kumasi", farmSize: 3, mainCrops: "Tomatoes, Pepper" },
    { name: "Yaw Mensah", phone: "0244333444", region: "Eastern", town: "Nkawkaw", farmSize: 10, mainCrops: "Cocoa, Plantain" },
    { name: "Akua Dapaah", phone: "0244444555", region: "Central", town: "Cape Coast", farmSize: 4, mainCrops: "Yam, Cassava" },
    { name: "Kwame Tetteh", phone: "0244555666", region: "Volta", town: "Ho", farmSize: 6, mainCrops: "Rice, Maize" },
    { name: "Fiifi Mensah", phone: "0244777888", region: "Central", town: "Kasoa", farmSize: 8, mainCrops: "Watermelon, Pineapple" },
    { name: "Mansa Musah", phone: "0244888999", region: "Northern", town: "Tamale", farmSize: 15, mainCrops: "Soybeans, Yam" },
    { name: "Abena Owusu", phone: "0244666777", region: "Greater Accra", town: "Dodowa", farmSize: 2, mainCrops: "Okra, Garden Eggs" },
  ];

  for (const f of farmers) {
    const pass = await bcrypt.hash("farmer123", 10);
    const user = await prisma.user.upsert({
      where: { phone: f.phone },
      update: {},
      create: { name: f.name, phone: f.phone, password: pass, role: "farmer", status: "approved" },
    });
    await prisma.farmer.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id, name: f.name, phone: f.phone, region: f.region, town: f.town, farmSize: f.farmSize, mainCrops: f.mainCrops },
    });
  }

  // Create buyer users
  const buyers = [
    { name: "Grace Food Supplies", phone: "0201112222", businessType: "Market Trader", location: "Accra", lookingFor: "Tomatoes, Pepper, Onions" },
    { name: "Eastern Restaurant", phone: "0202223333", businessType: "Restaurant", location: "Koforidua", lookingFor: "Plantain, Yam, Cassava" },
    { name: "FreshMart Supermarket", phone: "0204445555", businessType: "Supermarket", location: "Accra", lookingFor: "All vegetables, fruits" },
    { name: "Agro Export Co.", phone: "0205556666", businessType: "Exporter", location: "Tema", lookingFor: "Cocoa, Pineapple, Watermelon" },
    { name: "Koforidua SHS", phone: "0202020202", businessType: "Boarding School", location: "Koforidua", lookingFor: "Maize, Rice, Yam, Cassava" },
  ];

  for (const b of buyers) {
    const pass = await bcrypt.hash("buyer123", 10);
    const user = await prisma.user.upsert({
      where: { phone: b.phone },
      update: {},
      create: { name: b.name, phone: b.phone, password: pass, role: "buyer", status: "approved" },
    });
    await prisma.buyer.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id, name: b.name, phone: b.phone, businessType: b.businessType, location: b.location, lookingFor: b.lookingFor },
    });
  }

  // Create listings
  const allFarmers = await prisma.farmer.findMany();
  const cropData = [
    { crop: "Maize", qty: 20, price: 120, region: "Eastern", location: "Koforidua", farmerIdx: 0, grade: "Grade A — Premium" },
    { crop: "Cassava", qty: 50, price: 80, region: "Ashanti", location: "Kumasi", farmerIdx: 1, grade: "Grade B — Good" },
    { crop: "Tomatoes", qty: 10, price: 200, region: "Ashanti", location: "Kumasi", farmerIdx: 1, grade: "Grade A — Premium" },
    { crop: "Pepper (Chili)", qty: 8, price: 350, region: "Ashanti", location: "Kumasi", farmerIdx: 1, grade: "Grade A — Premium" },
    { crop: "Cocoa", qty: 30, price: 1300, region: "Eastern", location: "Nkawkaw", farmerIdx: 2, grade: "Grade A — Premium" },
    { crop: "Plantain", qty: 15, price: 150, region: "Eastern", location: "Nkawkaw", farmerIdx: 2, grade: "Grade B — Good" },
    { crop: "Yam", qty: 40, price: 180, region: "Central", location: "Cape Coast", farmerIdx: 3, grade: "Grade A — Premium" },
    { crop: "Rice", qty: 25, price: 250, region: "Volta", location: "Ho", farmerIdx: 4, grade: "Grade B — Good" },
    { crop: "Watermelon", qty: 20, price: 80, region: "Central", location: "Kasoa", farmerIdx: 5, grade: "Grade A — Premium" },
    { crop: "Soybeans", qty: 40, price: 280, region: "Northern", location: "Tamale", farmerIdx: 6, grade: "Grade B — Good" },
    { crop: "Okra", qty: 5, price: 120, region: "Greater Accra", location: "Dodowa", farmerIdx: 7, grade: "Grade A — Premium" },
    { crop: "Pineapple", qty: 15, price: 90, region: "Central", location: "Kasoa", farmerIdx: 5, grade: "Grade A — Premium" },
  ];

  for (let i = 0; i < cropData.length; i++) {
    const c = cropData[i];
    const farmer = allFarmers[c.farmerIdx];
    if (!farmer) continue;
    await prisma.listing.create({
      data: {
        crop: c.crop, quantity: c.qty, price: c.price, grade: c.grade,
        region: c.region, location: c.location, farmerId: farmer.id,
        harvestDate: "2026-08-15", notes: i % 3 === 0 ? "Freshly harvested, ready for pickup" : "",
        status: i % 5 === 0 ? "sold" : i % 4 === 0 ? "reserved" : "available",
        postedDate: "2026-08-" + String(20 + (i % 5)).padStart(2, "0"),
      },
    });
  }

  // Create prices
  const marketPrices = [
    { crop: "Maize", market: "Makola Market", region: "Greater Accra", lowPrice: 110, highPrice: 130, trend: "up" },
    { crop: "Cassava", market: "Central Market", region: "Ashanti", lowPrice: 60, highPrice: 90, trend: "stable" },
    { crop: "Tomatoes", market: "Makola Market", region: "Greater Accra", lowPrice: 180, highPrice: 220, trend: "up" },
    { crop: "Yam", market: "Koforidua Market", region: "Eastern", lowPrice: 150, highPrice: 200, trend: "down" },
    { crop: "Pepper (Chili)", market: "Central Market", region: "Ashanti", lowPrice: 300, highPrice: 400, trend: "up" },
    { crop: "Onions", market: "Agbogbloshie", region: "Greater Accra", lowPrice: 100, highPrice: 140, trend: "down" },
    { crop: "Rice", market: "Ho Market", region: "Volta", lowPrice: 230, highPrice: 270, trend: "stable" },
    { crop: "Plantain", market: "Koforidua Market", region: "Eastern", lowPrice: 120, highPrice: 180, trend: "stable" },
    { crop: "Cocoa", market: "Tema Port", region: "Greater Accra", lowPrice: 1200, highPrice: 1400, trend: "up" },
    { crop: "Soybeans", market: "Tamale Market", region: "Northern", lowPrice: 260, highPrice: 300, trend: "stable" },
  ];

  for (const p of marketPrices) {
    await prisma.price.create({ data: { ...p, date: "2026-08-25" } });
  }

  console.log("Seed complete! Created:", farmers.length, "farmers,", buyers.length, "buyers,", cropData.length, "listings,", marketPrices.length, "prices");
}

main().catch(console.error).finally(() => prisma.$disconnect());