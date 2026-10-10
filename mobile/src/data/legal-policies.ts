export type PolicySection = {
  title: string;
  body: string;
};

export type PolicyDocument = {
  title: string;
  intro: string;
  updatedAt: string;
  sections: PolicySection[];
};

export const termsPolicy: PolicyDocument = {
  title: "Terms & Conditions",
  intro:
    "Welcome to KTMONA. These Terms & Conditions govern your use of our marketplace. By accessing or using the Platform, you agree to comply with and be bound by these Terms.",
  updatedAt: "01 April 2026",
  sections: [
    {
      title: "About KTMONA",
      body:
        "KTMONA is a multi-vendor e-commerce marketplace that connects customers with independent sellers offering ethical, sustainable, and culturally inspired fashion and lifestyle products. KTMONA does not take ownership of inventory and acts solely as a facilitator between buyers and sellers.",
    },
    {
      title: "Eligibility",
      body:
        "Users must be at least 18 years of age to register or make purchases and must have the legal capacity to enter into a binding contract under applicable Indian laws.",
    },
    {
      title: "User Account",
      body:
        "You are responsible for maintaining the confidentiality of your account credentials, and all activities conducted through your account are your responsibility. KTMONA may suspend or terminate accounts for suspicious, fraudulent, or abusive activity.",
    },
    {
      title: "Vendor Participation",
      body:
        "Vendors must provide accurate product information, comply with applicable laws, uphold ethical sourcing and fair labor practices, fulfill orders promptly, and handle returns, refunds, and customer service according to platform policies. Counterfeit, illegal, hazardous, restricted, or rights-infringing items are prohibited. KTMONA may charge a commission or service fee as outlined in a separate Vendor Agreement.",
    },
    {
      title: "Product Listings and Pricing",
      body:
        "Product descriptions, pricing, and availability are the responsibility of vendors. Prices are listed in INR and may include or exclude taxes as specified. Product color, texture, and appearance may vary slightly because of lighting, photography, or screen settings. Handmade products may have slight variations and are not considered defects. Customers should refer to vendor size charts.",
    },
    {
      title: "Orders and Payments",
      body:
        "By placing an order, you agree to purchase the selected products subject to availability. Payments are processed through secure third-party gateways. KTMONA is not liable for failed transactions, gateway errors, unauthorized transactions, duplicate charges, or chargebacks caused by third-party providers. Orders may be cancelled for pricing or listing errors.",
    },
    {
      title: "Shipping and Delivery",
      body:
        "Shipping timelines and charges are determined by individual vendors. Delivery timelines are estimates, not guarantees, and risk of loss or damage passes to the customer upon successful delivery confirmation.",
    },
    {
      title: "Returns, Refunds, and Cancellations",
      body:
        "Return and refund policies may vary by vendor but must meet KTMONA' minimum standards. Refunds are processed to the original payment method within 7-10 business days after approval. Orders may be cancelled before shipment; post-shipment cancellations are treated as returns.",
    },
    {
      title: "Intellectual Property",
      body:
        "All platform content is owned by KTMONA or its licensors. Unauthorized use, reproduction, or distribution is prohibited. Vendors retain ownership of their product images and descriptions but grant KTMONA a non-exclusive license to use them for promotional purposes.",
    },
    {
      title: "Ethical and Sustainability Commitment",
      body:
        "KTMONA promotes fair trade, ethical sourcing, environmentally sustainable materials, and respect for traditional artisans and craftsmanship. Vendors who violate these principles may be removed from the Platform.",
    },
    {
      title: "Prohibited Activities",
      body:
        "Users and vendors must not engage in fraudulent or deceptive practices, upload harmful content, attempt unauthorized access, or violate any applicable laws.",
    },
    {
      title: "Limitation of Liability",
      body:
        "KTMONA acts as a marketplace intermediary and is not liable for the quality, safety, or legality of products sold by vendors. To the maximum extent permitted by law, KTMONA shall not be liable for indirect, incidental, or consequential damages arising from platform use.",
    },
    {
      title: "Indemnification",
      body:
        "Users and vendors agree to indemnify and hold harmless KTMONA, its directors, employees, and affiliates from claims, damages, or expenses arising from a breach of these Terms or any law.",
    },
    {
      title: "Disclaimer of Warranties",
      body:
        "All products and services are provided on an as is and as available basis without warranties of any kind, including merchantability, fitness for a particular purpose, or non-infringement.",
    },
    {
      title: "Privacy",
      body:
        "Your use of the Platform is also governed by our Privacy Policy, and we may use third-party analytics or advertising tools for marketing and performance tracking.",
    },
    {
      title: "Third-Party Links",
      body:
        "The Platform may contain links to third-party websites. KTMONA is not responsible for the content or practices of external sites.",
    },
    {
      title: "Termination",
      body:
        "KTMONA may suspend or terminate access for any user or vendor who violates these Terms, without prior notice.",
    },
    {
      title: "Governing Law and Jurisdiction",
      body:
        "These Terms are governed by the laws of India. Any unresolved dispute will be referred to arbitration under the Arbitration and Conciliation Act, 1996, with the seat of arbitration in Faridabad, Haryana.",
    },
    {
      title: "Amendments",
      body:
        "KTMONA may update or modify these Terms at any time. Continued use of the Platform after changes constitutes acceptance of the revised Terms.",
    },
    {
      title: "Force Majeure",
      body:
        "KTMONA is not liable for failure or delay caused by events beyond reasonable control, including natural disasters, pandemics, strikes, governmental actions, internet failures, platform downtime, or cyber incidents.",
    },
    {
      title: "Contact Information",
      body:
        "For grievance matters, contact the KTMONA Grievance Desk at monika99skb@gmail.com. For general support, email monika99skb@gmail.com, call 8766211837, or write to KTMONA, A-740, Vinay Nagar, Agwanpur, Faridabad, Haryana 121013, India.",
    },
  ],
};

export const privacyPolicy: PolicyDocument = {
  title: "Privacy Policy",
  intro:
    "KTMONA is committed to protecting your privacy and ensuring your personal information is handled safely and responsibly.",
  updatedAt: "01 April 2026",
  sections: [
    { title: "Introduction", body: "This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit or use the Platform." },
    { title: "Information We Collect", body: "We collect personal information such as name, email, phone number, addresses, payment information processed by third-party gateways, login details, non-personal information such as IP address, browser and device details, and vendor information such as business details, GSTIN, PAN, bank details, listings, and transaction history." },
    { title: "How We Use Your Information", body: "We use collected information to process and fulfill orders, facilitate vendor onboarding and payments, provide support, improve the platform, send transactional and promotional communications, prevent fraud, and comply with legal obligations." },
    { title: "Sharing of Information", body: "We may share information with vendors to fulfill orders, payment gateways, logistics partners, legal authorities when required by law, and service providers that help operate the Platform. We do not sell or rent personal information to third parties." },
    { title: "Cookies Policy", body: "We use cookies to enhance user experience and analyze traffic. You can disable cookies in your browser, but some features may not function properly." },
    { title: "Data Security", body: "We use reasonable administrative, technical, and physical safeguards to protect data, but no online transmission is fully secure. We will notify affected users in accordance with applicable laws if a breach occurs." },
    { title: "Data Retention", body: "Personal data is retained only as long as necessary for the purposes described in this policy or as required by law." },
    { title: "User Rights", body: "Under applicable Indian laws, users may access, review, correct, update, withdraw consent for marketing, or request deletion of their data, subject to legal obligations." },
    { title: "Children’s Privacy", body: "Our services are not intended for individuals under 18, and we do not knowingly collect personal information from minors." },
    { title: "Changes to This Policy", body: "We may update this Privacy Policy at any time and changes will be posted with an updated effective date." },
    { title: "Contact Us", body: "Contact monika99skb@gmail.com or monika99skb@gmail.com for privacy or grievance matters. Address: KTMONA, A-740, Vinay Nagar, Agwanpur, Faridabad, Haryana 121013, India." },
  ],
};

export const returnPolicy: PolicyDocument = {
  title: "Return & Refund Policy",
  intro:
    "KTMONA manages returns and refunds with individual vendors while maintaining a consistent customer experience.",
  updatedAt: "01 April 2026",
  sections: [
    { title: "Eligibility for Returns", body: "Customers may request a return if the product is damaged, defective, incorrect, or significantly different from its description, and the request is raised within 7 days of delivery." },
    { title: "Return Process", body: "Log in to your account, open My Orders, select the item, click Request Return, provide the reason and supporting images, and wait for pickup approval." },
    { title: "Refunds", body: "Refunds are initiated after the returned product passes quality inspection and are credited to the original payment method within 7-10 business days. COD refunds are processed to the customer’s bank account." },
    { title: "Contact Us", body: "For return assistance, contact monika99skb@gmail.com or call 8766211837." },
  ],
};

export const refundPolicy: PolicyDocument = {
  title: "Refund Policy",
  intro: "Refunds are issued to the original payment source after cancellation or approved return verification.",
  updatedAt: "01 April 2026",
  sections: [
    { title: "Approval Process", body: "Refund initiation starts after return quality check approval or seller-side cancellation confirmation." },
    { title: "Credited Time", body: "UPI and wallet refunds are usually credited within 2-4 business days, and card or net-banking refunds within 5-7 business days." },
    { title: "Partial Refunds", body: "Partial refunds may be issued for partial returns, promotional adjustments, or policy-based deductions where applicable." },
    { title: "Refund Escalation", body: "If your refund is delayed beyond the SLA, contact monika99skb@gmail.com with your order ID and payment reference." },
  ],
};

export const shippingPolicy: PolicyDocument = {
  title: "Shipping & Delivery Policy",
  intro: "KTMONA collaborates with trusted logistics partners to deliver products across India. Shipping timelines may vary by vendor.",
  updatedAt: "01 April 2026",
  sections: [
    { title: "Order Processing", body: "Orders are typically processed within 1-3 business days after confirmation, and vendors are responsible for packaging and dispatching products." },
    { title: "Delivery Timelines", body: "Metro cities usually take 3-5 business days, non-metro cities 5-7 business days, and remote areas 7-10 business days." },
    { title: "Shipping Charges", body: "Shipping charges, if applicable, are displayed at checkout. Free shipping may be offered during promotional campaigns." },
    { title: "Order Tracking", body: "Customers receive tracking details via SMS and email once the order is shipped." },
    { title: "Cash on Delivery", body: "COD is available for selected pin codes. KTMONA may limit or cancel COD orders for high-value or suspected fraudulent transactions." },
    { title: "Delivery Delays", body: "Delays may occur because of natural disasters, government restrictions, logistics partner issues, or incorrect shipping information provided by the customer." },
    { title: "Damaged Packages", body: "Customers should inspect packages at delivery and report damage within 24 hours with photographic evidence." },
  ],
};

export const vendorAgreementPolicy: PolicyDocument = {
  title: "Vendor Agreement",
  intro: "This summary version covers the main vendor obligations, compliance requirements, and settlement terms that apply to sellers on KTMONA.",
  updatedAt: "01 April 2026",
  sections: [
    { title: "Eligibility", body: "Vendors must be legally registered businesses in India and comply with applicable laws, including GST regulations." },
    { title: "Vendor Obligations", body: "Vendors must provide accurate product information and pricing, ensure ethical sourcing and fair labor practices, maintain inventory levels, dispatch within timelines, and handle returns and customer service efficiently." },
    { title: "Commission and Fees", body: "KTMONA charges commission on each successful sale, and settlements are made within 7-15 business days after order completion, subject to deductions for returns or cancellations." },
    { title: "Intellectual Property", body: "Vendors retain ownership of trademarks and product images but grant KTMONA a non-exclusive, royalty-free license to use them for promotional purposes." },
    { title: "Prohibited Activities", body: "Vendors must not sell counterfeit or illegal products, violate intellectual property rights, or engage in misleading or deceptive practices." },
    { title: "Compliance with Ethical Standards", body: "KTMONA promotes sustainability and ethical sourcing, and vendors found violating these principles may face suspension or termination." },
    { title: "Termination", body: "Either party may terminate the agreement with 30 days’ written notice. Immediate termination may occur in cases of legal violations or policy breaches." },
    { title: "Indemnification", body: "Vendors agree to indemnify and hold KTMONA harmless from any claims arising from their products or actions." },
    { title: "Legal and Compliance", body: "GST invoicing responsibility lies with the vendor, and product prices must include GST as applicable." },
    { title: "Governing Law", body: "This Agreement is governed by the laws of India, with jurisdiction in Faridabad, Haryana." },
    { title: "Contact Information", body: "For vendor inquiries, contact monika99skb@gmail.com or call 8766211837. Address: KTMONA, A-740, Vinay Nagar, Agwanpur, Faridabad, Haryana 121013, India." },
  ],
};

/** Same text as the website's About Us page. */
export const aboutPolicy: PolicyDocument = {
  title: "About Us",
  intro:
    "“Trust Every Click.” KTMONA stands for Knowledge, Trust & More Online Network Access. We built KTMONA so that shopping online from independent sellers feels as safe as buying from a store you already know.",
  updatedAt: "October 5, 2026",
  sections: [
    {
      title: "Our Story",
      body:
        "KTMONA is a multi-vendor marketplace where small businesses, resellers and home-based sellers across India list their products, and customers shop with secure payments, tracked delivery and easy returns. Every seller is approved by our team and every product is reviewed before it goes live.",
    },
    {
      title: "Our Mission",
      body:
        "Our mission is to give every seller in India a simple, transparent way to sell online, and every customer a marketplace they can trust with each click.\n\n• Knowledge: Clear product information, honest reviews and simple tools for first-time online sellers.\n• Trust: Verified sellers, admin-approved listings and secure payments.\n• Access: Shop or sell from anywhere on the web and on the KTMONA app for Android and iOS.",
    },
    {
      title: "Why Choose Us",
      body:
        "• Products from verified sellers across India, all in one place.\n• Secure payments and a downloadable invoice for every order.\n• Live shipment tracking and easy returns on delivered orders.\n• Dedicated customer and seller support whenever you need it.",
    },
    {
      title: "Head Office",
      body: "A-740, Vinay Nagar, Agwanpur, Faridabad, Haryana 121013, India",
    },
  ],
};

/** Same text as the website's Disclaimer page. */
export const disclaimerPolicy: PolicyDocument = {
  title: "Disclaimer",
  intro:
    "The information provided by KTMONA (“we,” “us,” or “our”) on ktmona.com and the KTMONA app is for general informational purposes only. All information is provided in good faith; however, we make no representation or warranty of any kind, express or implied, regarding the accuracy, adequacy, validity, reliability, availability, or completeness of any information.",
  updatedAt: "October 25, 2023",
  sections: [
    {
      title: "Product Accuracy",
      body:
        "KTMONA is a multi-vendor marketplace. While we strive to ensure that product images, descriptions, and specifications provided by our sellers are accurate, the actual color, texture, and fit may vary slightly from what is displayed on your screen. We do not warrant that product descriptions or other content are fully accurate, complete, reliable, current, or error-free.",
    },
    {
      title: "Vendor Liability",
      body:
        "Products sold on this platform are listed and fulfilled by independent sellers. KTMONA acts strictly as an intermediary marketplace facilitator.\n\n• We are not directly responsible for the manufacturing process, quality control, or safety standards of the items sold by third-party vendors.\n• Any claims, disputes, or liabilities arising from the purchase or use of a product rest entirely with the respective seller.",
    },
    {
      title: "Third-Party Links",
      body:
        "The app may contain links to other websites or content belonging to or originating from third parties. Such external links are not investigated, monitored, or checked for accuracy, adequacy, validity, reliability, availability, or completeness by us.",
    },
    {
      title: "Limitation of Damages",
      body:
        "Under no circumstance shall we have any liability to you for any loss or damage of any kind incurred as a result of the use of the app or reliance on any information provided. Your use of the app and your reliance on any information is solely at your own risk.",
    },
  ],
};
