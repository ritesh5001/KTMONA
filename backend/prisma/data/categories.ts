/**
 * KTMONA storefront taxonomy.
 *
 * Three levels: main category → group → leaf. The 19 main categories are the
 * KTMONA list; groups and leaves follow Meesho's catalogue menu, with each
 * leaf living in exactly one place (Meesho repeats e.g. men's watches under
 * Men, Accessories and Watches; here they only sit under Watches).
 *
 * Sellers list products against leaves. Main categories and groups exist for
 * navigation and filtering; a product listed under a leaf shows up when a
 * shopper browses its group or main category.
 */
export interface CategoryGroup {
    name: string;
    items: string[];
}

export interface MainCategory {
    name: string;
    slug: string;
    description: string;
    groups: CategoryGroup[];
}

export const KTMONA_CATEGORIES: MainCategory[] = [
    {
        name: 'Kurti & Saree',
        slug: 'kurti-saree',
        description: 'Sarees, kurtis, kurta sets, dress materials, lehengas and more ethnic wear for women.',
        groups: [
            { name: 'Sarees', items: ['Silk Sarees', 'Cotton Sarees', 'Georgette Sarees', 'Chiffon Sarees', 'Net Sarees', 'Bridal Sarees'] },
            { name: 'Kurtis', items: ['Anarkali Kurtis', 'Rayon Kurtis', 'Cotton Kurtis', 'Straight Kurtis', 'Long Kurtis'] },
            { name: 'Kurta Sets', items: ['Kurta Palazzo Sets', 'Kurta Pant Sets', 'Sharara Sets', 'Anarkali Kurta Sets', 'Cotton Kurta Sets'] },
            { name: 'Dupatta Sets', items: ['Cotton Dupatta Sets', 'Rayon Dupatta Sets'] },
            { name: 'Dress Materials', items: ['Pakistani Dress Materials', 'Cotton Dress Materials', 'Patiala Dress Materials', 'Banarasi Dress Materials', 'Party Wear Dress Materials'] },
            { name: 'Lehengas & Gowns', items: ['Party Wear Lehengas', 'Bridal Lehengas', 'Ethnic Gowns'] },
            { name: 'Blouses', items: ['Readymade Blouses', 'Blouse Pieces'] },
            { name: 'Other Ethnic', items: ['Ethnic Skirts & Bottomwear', 'Ethnic Jackets & Shrugs', 'Islamic Fashion', 'Petticoats', 'Dupattas'] },
        ],
    },
    {
        name: 'Women Western',
        slug: 'women-western',
        description: 'Tops, dresses, jeans, winterwear, plus size and maternity wear for women.',
        groups: [
            { name: 'Topwear', items: ['Tops & Tunics', 'Dresses', 'T-Shirts', 'Gowns', 'Tops & Bottom Sets', 'Shirts', 'Jumpsuits'] },
            { name: 'Bottomwear', items: ['Jeans & Jeggings', 'Palazzos', 'Trousers & Pants', 'Leggings', 'Shorts & Skirts'] },
            { name: 'Winterwear', items: ['Jackets', 'Sweatshirts', 'Sweaters', 'Capes, Shrugs & Ponchos', 'Coats', 'Blazers & Waistcoats'] },
            { name: 'Plus Size', items: ['Plus Size Dresses & Gowns', 'Plus Size Tops & Tees', 'Plus Size Bottomwear'] },
            { name: 'Sportswear', items: ['Sports Bottomwear', 'Sports Top & Bottom Sets'] },
            { name: 'Maternity', items: ['Maternity Kurtis & Topwear', 'Maternity Bottomwear'] },
        ],
    },
    {
        name: 'Lingerie',
        slug: 'lingerie',
        description: 'Bras, panties, lingerie sets, shapewear and sleepwear for women.',
        groups: [
            { name: 'Innerwear', items: ['Bras', 'Panties', 'Lingerie Sets', 'Shapewear', 'Camisoles & Slips'] },
            { name: 'Sleepwear', items: ['Nightsuits', 'Nightdresses', 'Babydolls', 'Other Sleepwear'] },
            { name: 'Sports & Maternity', items: ['Sports Bras', 'Feeding Bras'] },
        ],
    },
    {
        name: 'Men',
        slug: 'men',
        description: 'T-shirts, shirts, jeans, ethnic wear, innerwear and activewear for men.',
        groups: [
            { name: 'Top Wear', items: ['T-Shirts', 'Shirts', 'T-Shirt Combos', 'Shirt Combos'] },
            { name: 'Bottom Wear', items: ['Jeans', 'Cargos & Trousers', 'Track Pants', 'Shorts'] },
            { name: 'Ethnic Wear', items: ['Kurtas', 'Kurta Sets', 'Nehru Jackets', 'Dhotis & Lungis'] },
            { name: 'Innerwear & Sleepwear', items: ['Vests', 'Briefs', 'Boxers', 'Innerwear Combos', 'Pyjamas', 'Night Shorts', 'Nightsuits'] },
            { name: 'Active & Winter Wear', items: ['Tracksuits', 'Gym T-Shirts', 'Jackets', 'Sweatshirts'] },
        ],
    },
    {
        name: 'Kids & Toys',
        slug: 'kids-toys',
        description: 'Clothing for girls, boys and babies, toys, games and baby care.',
        groups: [
            { name: 'Girls Clothing', items: ['Frocks & Dresses', 'Girls Clothing Sets', 'Girls Tops & T-Shirts', 'Girls Ethnic Wear'] },
            { name: 'Boys Clothing', items: ['Boys T-Shirts & Polos', 'Boys Clothing Sets', 'Boys Shirts', 'Boys Ethnic Wear'] },
            { name: 'Baby Clothing', items: ['Rompers & Onesies', 'Baby Clothing Sets'] },
            { name: 'Toys & Games', items: ['Soft Toys', 'Educational Toys', 'Remote Control Toys', 'Board Games & Puzzles', 'Outdoor Toys', 'Party Items'] },
            { name: 'Baby Care', items: ['Diapers', 'Baby Bedding & Accessories', 'Newborn Care', 'Baby Gear', 'Baby Mosquito Nets', 'Baby Dry Sheets'] },
            { name: 'Kids Accessories', items: ['Kids Bags & Backpacks', 'Kids Hair Accessories'] },
        ],
    },
    {
        name: 'Home & Kitchen',
        slug: 'home-kitchen',
        description: 'Home decor, kitchenware, furnishing, home essentials and furniture.',
        groups: [
            { name: 'Home Decor', items: ['Showpieces & Idols', 'Clocks & Wall Decor', 'Wallpapers & Stickers', 'Artificial Plants', 'Pooja Needs', 'Key Holders', 'Covers', 'Party Supplies'] },
            { name: 'Kitchen & Dining', items: ['Storage & Organizers', 'Cookware', 'Kitchen Tools', 'Dinnerware', 'Glasses & Barware', 'Kitchen Linen'] },
            { name: 'Home Furnishing', items: ['Bedsheets', 'Curtains & Accessories', 'Doormats & Carpets', 'Pillows, Cushions & Covers', 'Blankets & Comforters'] },
            { name: 'Home Essentials', items: ['Bathroom Accessories', 'Cleaning Supplies', 'Gardening', 'Home Tools', 'Insect Protection', 'Shoe Racks'] },
            { name: 'Furniture', items: ['Study Tables', 'Collapsible Wardrobes', 'Wall Shelves', 'Home Temples', 'Hammock Swings'] },
        ],
    },
    {
        name: 'Beauty & Health',
        slug: 'beauty-health',
        description: 'Makeup, skincare, haircare, fragrance, grooming and wellness.',
        groups: [
            { name: 'Makeup', items: ['Lipstick', 'Eye Makeup', 'Face Makeup', 'Makeup Kits & Combos', 'Nail Makeup', 'Makeup Brushes & Accessories'] },
            { name: 'Skincare', items: ['Body Lotion', 'Face Creams', 'Face Oil & Serum', 'Face Wash', 'Face Masks & Peels', 'Soaps & Scrubs'] },
            { name: 'Haircare', items: ['Hair Oil & Shampoo', 'Hair Straighteners & Dryers', 'Hair Curlers', 'Hair Removal'] },
            { name: 'Fragrance', items: ['Perfumes', 'Men Perfumes & Deodorants'] },
            { name: 'Men Grooming', items: ['Trimmers', 'Beard Oil', 'Hair Gels, Wax & Spray', 'Men Face & Body Care', 'Grooming Kits'] },
            { name: 'Wellness', items: ['Oral Care', 'Winter Healthcare', 'Ear Cleaners', 'Health Monitors & Massagers', 'Foot Care', 'Sexual Wellness', 'Ayurveda & Nutrition', 'Sanitary Pads & More'] },
            { name: 'Mom & Baby Care', items: ['Baby Care Essentials', 'Mom Care'] },
        ],
    },
    {
        name: 'Jewellery & Accessories',
        slug: 'jewellery-accessories',
        description: 'Women jewellery, men jewellery and fashion accessories.',
        groups: [
            { name: 'Women Jewellery', items: ['Jewellery Sets', 'Earrings', 'Mangalsutras', 'Necklaces & Chains', 'Bangles & Bracelets', 'Anklets & Nosepins', 'Kamarbandh & Maangtika', 'Rings'] },
            { name: 'Men Accessories', items: ['Men Jewellery', 'Men Wallets', 'Men Belts', 'Men Sunglasses & Frames'] },
            { name: 'Women Accessories', items: ['Hair Accessories', 'Women Belts', 'Women Sunglasses & Frames', 'Scarves, Stoles & Gloves', 'Women Wallets'] },
        ],
    },
    {
        name: 'Bags & Footwear',
        slug: 'bags-footwear',
        description: 'Footwear for women, men and kids, handbags, backpacks and travel bags.',
        groups: [
            { name: 'Women Footwear', items: ['Heels & Sandals', 'Flats', 'Boots', 'Women Flip Flops & Slippers', 'Bellies & Ballerinas'] },
            { name: 'Men Footwear', items: ['Casual Shoes', 'Sports Shoes', 'Men Flip Flops & Sandals', 'Formal Shoes', 'Loafers'] },
            { name: 'Kids Footwear', items: ['Boys Shoes', 'Girls Shoes', 'Kids Sandals', 'Kids Flip Flops & Slippers'] },
            { name: 'Women Bags', items: ['Handbags', 'Sling Bags', 'Clutches', 'Women Backpacks'] },
            { name: 'Men Bags', items: ['Men Backpacks', 'Waist Bags', 'Crossbody Bags'] },
            { name: 'Travel Bags', items: ['Duffel & Trolley Bags', 'Laptop & Messenger Bags'] },
        ],
    },
    {
        name: 'Electronics',
        slug: 'electronics',
        description: 'Smartphones, audio, mobile accessories, camera gear and computer accessories.',
        groups: [
            { name: 'Smartphones', items: ['Android Phones', 'Feature Phones'] },
            { name: 'Audio', items: ['Bluetooth Earbuds', 'Neckbands', 'Headphones', 'Wired Earphones', 'Speakers'] },
            { name: 'Mobile Accessories', items: ['Cases & Covers', 'Mobile Holders', 'Chargers & Cables', 'Power Banks', 'Screen Guards'] },
            { name: 'Camera & Creator', items: ['Microphones', 'Selfie Sticks & Ring Lights', 'Tripods & Monopods'] },
            { name: 'Computer Accessories', items: ['Keyboards & Mice', 'Pen Drives & Memory Cards', 'Laptop Accessories'] },
        ],
    },
    {
        name: 'Watches',
        slug: 'watches',
        description: 'Analog, digital and smart watches for men, women and kids.',
        groups: [
            { name: 'Men Watches', items: ['Men Analog Watches', 'Men Digital Watches', 'Men Sports Watches'] },
            { name: 'Women Watches', items: ['Women Analog Watches', 'Women Digital Watches', 'Bracelet Watches'] },
            { name: 'Smart Watches', items: ['Smartwatches', 'Fitness Bands'] },
            { name: 'More Watches', items: ['Couple Watches', 'Kids Watches', 'Watch Bands & Boxes'] },
        ],
    },
    {
        name: 'Electricals',
        slug: 'electricals',
        description: 'Kitchen and home appliances, lighting and electrical fittings.',
        groups: [
            { name: 'Kitchen Appliances', items: ['Mixers & Grinders', 'Electric Kettles', 'Induction Cooktops', 'Sandwich Makers & Toasters', 'Choppers & Blenders'] },
            { name: 'Home Appliances', items: ['Irons', 'Fans', 'Room Heaters', 'Water Heaters & Geysers', 'Vacuum Cleaners'] },
            { name: 'Lighting', items: ['LED Bulbs', 'Decorative Lights', 'Emergency Lights', 'Torches'] },
            { name: 'Electrical Fittings', items: ['Extension Boards', 'Switches & Sockets', 'Wires & Cables', 'Plugs & Adapters'] },
        ],
    },
    {
        name: 'Sports & Fitness',
        slug: 'sports-fitness',
        description: 'Fitness equipment, yoga and gear for cricket, football, badminton and more.',
        groups: [
            { name: 'Fitness', items: ['Dumbbells & Weights', 'Exercise Bands', 'Yoga', 'Skipping Ropes', 'Hand Grips', 'Sweat Belts', 'Tummy Trimmers', 'Fitness Accessories'] },
            { name: 'Sports', items: ['Cricket', 'Football', 'Badminton', 'Volleyball', 'Cycles & Accessories', 'Skating', 'Swimming', 'Fishing'] },
        ],
    },
    {
        name: 'Car & Motorbike',
        slug: 'car-motorbike',
        description: 'Helmets, riding gear, bike and car accessories and car care.',
        groups: [
            { name: 'Bike Accessories', items: ['Bike LED Lights', 'Bike Covers', 'Bike Parts & Accessories', 'Scooty Accessories'] },
            { name: 'Riding Gear', items: ['Helmets', 'Safety Gear & Clothing'] },
            { name: 'Car Accessories', items: ['Car Interior Accessories', 'Car Exterior Accessories', 'Car Covers', 'Car Mobile Holders & Chargers'] },
            { name: 'Car Care', items: ['Car Cleaning & Care', 'Car Repair Tools'] },
        ],
    },
    {
        name: 'Office Supplies & Stationery',
        slug: 'office-supplies-stationery',
        description: 'Pens, notebooks, art and craft supplies and office essentials.',
        groups: [
            { name: 'Writing', items: ['Pens & Pencils', 'Diaries & Notebooks'] },
            { name: 'Art & Craft', items: ['Art & Craft Supplies', 'Drawing & Painting Kits'] },
            { name: 'Office Supplies', items: ['Files & Desk Organizers', 'Adhesives & Tapes', 'Calculators', 'Staplers & Punches'] },
        ],
    },
    {
        name: 'Grocery',
        slug: 'grocery',
        description: 'Dry fruits, masalas, snacks, sweets, tea and coffee.',
        groups: [
            { name: 'Cooking Essentials', items: ['Masala & Spices', 'Pickles & Chutneys', 'Dry Fruits & Nuts'] },
            { name: 'Snacks & Sweets', items: ['Snacks & Namkeen', 'Chocolates & Candies', 'Biscuits & Cookies'] },
            { name: 'Beverages', items: ['Tea', 'Coffee'] },
        ],
    },
    {
        name: 'Books',
        slug: 'books',
        description: 'Novels, children\'s books, self-help, religious books and exam preparation.',
        groups: [
            { name: 'General Books', items: ['Novels', "Children's Books", 'Motivational Books', 'Religious Books', 'Economics & Commerce'] },
            { name: 'Academic & Exams', items: ['UPSC & Central Exams', 'Competitive Exams', 'Reference Books', 'School Textbooks & Guides', 'University Books & Guides'] },
        ],
    },
    {
        name: 'Pet Supplies',
        slug: 'pet-supplies',
        description: 'Food, toys, grooming, collars and aquarium supplies for pets.',
        groups: [
            { name: 'Dogs & Cats', items: ['Pet Food & Treats', 'Pet Toys', 'Collars & Leashes', 'Pet Clothes & Grooming', 'Pet Bowls'] },
            { name: 'Fish & Aquarium', items: ['Aquarium Accessories'] },
        ],
    },
    {
        name: 'Musical Instruments',
        slug: 'musical-instruments',
        description: 'Guitars, keyboards, drums, wind instruments and accessories.',
        groups: [
            { name: 'Instruments', items: ['String Instruments', 'Piano & Keyboards', 'Dholaks & Drum Sets', 'Wind Instruments'] },
            { name: 'Accessories', items: ['Musical Accessories'] },
        ],
    },
];
