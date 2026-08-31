// Ghana's 16 regions with their capitals and major towns
export const ghanaRegions: string[] = [
  "Greater Accra", "Eastern", "Ashanti", "Central", "Western",
  "Volta", "Northern", "Upper East", "Upper West", "Bono",
  "Bono East", "Ahafo", "Oti", "Western North", "Savannah", "North East"
];

// Each region: capital first, then other major towns
export const ghanaTowns: Record<string, string[]> = {
  "Greater Accra": ["Accra", "Tema", "Madina", "Kasoa", "Nungua", "Teshie", "Dodowa", "Amasaman", "Prampram", "Ada", "Achimota", "Kaneshie"],
  "Eastern": ["Koforidua", "Nkawkaw", "Suhum", "Akropong", "Aburi", "Nsawam", "Mampong", "Akyem Oda", "Begoro", "Somanya", "Asamankese", "Akwatia"],
  "Ashanti": ["Kumasi", "Obuasi", "Ejisu", "Bekwai", "Mampong", "Konongo", "Juaso", "Tafo", "Bompata", "Asante Mampong", "Juaben", "Ejura"],
  "Central": ["Cape Coast", "Winneba", "Swedru", "Mankessim", "Anomabo", "Saltpond", "Apam", "Twifo Praso", "Assin Fosu", "Oduponkro", "Kasoa", "Dunkwa"],
  "Western": ["Takoradi", "Sekondi", "Tarkwa", "Axim", "Nsuaem", "Bogoso", "Prestea", "Shama", "Essam", "Enchi", "Elmina", "Komenda"],
  "Volta": ["Ho", "Kpando", "Hohoe", "Aflao", "Sogakope", "Keta", "Anloga", "Dzodze", "Peki", "Juapong", "Kpeve", "Have"],
  "Northern": ["Tamale", "Yendi", "Savelugu", "Gushegu", "Karaga", "Tolon", "Kumbungu", "Saboba", "Sagnarigu", "Bimbilla", "Kpandai", "Walewale"],
  "Upper East": ["Bolgatanga", "Navrongo", "Bawku", "Zebilla", "Sandema", "Paga", "Bongo", "Tongo", "Garu", "Bawku West", "Binduri", "Pusiga"],
  "Upper West": ["Wa", "Lawra", "Nandom", "Jirapa", "Tumu", "Nadowli", "Hamile", "Funsi", "Gwollu", "Lambussie", "Wechiau", "Issa"],
  "Bono": ["Sunyani", "Berekum", "Dormaa Ahenkro", "Techiman", "Wenchi", "Sampa", "Chiraa", "Atronie", "Odumase", "Abesim", "Drobo", "Seikwa"],
  "Bono East": ["Techiman", "Kintampo", "Nkoranza", "Atebubu", "Yeji", "Prang", "Jema", "Kwame Danso", "Abease", "Kwabre", "Bomaa", "Tuobodom"],
  "Ahafo": ["Goaso", "Hwidiem", "Kenyasi", "Bechem", "Dormaa", "Asumura", "Sankore", "Acherensua", "Tepa", "Wuramumuso", "Kwabre", "Asumani"],
  "Oti": ["Dambai", "Kete Krachi", "Nkonya", "Kpassa", "Jasikan", "Kadjebi", "Worawora", "Borae", "Chai", "Ahamakma", "Banda", "Agyemadiem"],
  "Western North": ["Sefwi Wiawso", "Bibiani", "Enchi", "Sefwi Bekwai", "Dadieso", "Asankrangwa", "Juaboso", "Bodi", "Suaman", "Akatiso", "Anhwiaso", "Accra"],
  "Savannah": ["Damongo", "Bole", "Salaga", "Bamboi", "Tuna", "Sawla", "Buipe", "Larabanga", "Mankaragu", "Mempeasem", "Kpandai", "Yagba"],
  "North East": ["Nalerigu", "Gambaga", "Walewale", "Nkwanta", "Yagaba", "Bunkpurugu", "Yunyoo", "Chereponi", "Sakuba", "Gushiegu", "Kpassa", "Nakpanduri"]
};

export const ghanaCrops: string[] = [
  "Maize", "Cassava", "Yam", "Plantain", "Tomatoes", "Pepper (Chili)", "Onions",
  "Rice", "Cocoyam", "Groundnut", "Okra", "Garden Eggs", "Watermelon",
  "Pineapple", "Oil Palm", "Cocoa", "Soybeans", "Cashew", "Sorghum",
  "Millet", "Cowpea", "Sweet Potato", "Avocado", "Mango", "Orange",
  "Banana", "Pawpaw", "Coconut", "Ginger", "Garlic", "Cabbage",
  "Carrot", "Lettuce", "Cucumber", "Eggplant", "Water yam", "Tiger Nut",
  "Neglected Crop", " Shea Nut", "Teff", "Sunflower", "Sesame", "Black Pepper"
];