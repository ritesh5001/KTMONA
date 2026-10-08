import type { ReactNode } from "react";

export type PolicySection = {
  id: string;
  title: string;
  body: ReactNode;
};

export type PolicyDocument = {
  title: string;
  lastUpdated: string;
  intro?: ReactNode;
  sections: PolicySection[];
};

export const termsPolicy: PolicyDocument = {
  title: "Terms & Conditions",
  lastUpdated: "01 April 2026",
  intro: (
    <p>
      Welcome to KTMONA. These Terms &amp; Conditions govern your use of our website and marketplace. By accessing or using the Platform, you agree to comply with and be bound by these Terms.
    </p>
  ),
  sections: [
    {
      id: "about",
      title: "About KTMONA",
      body: (
        <p>
          KTMONA is a multi-vendor e-commerce marketplace that connects customers with independent sellers offering ethical, sustainable, and culturally inspired fashion and lifestyle products. KTMONA does not take ownership of inventory and acts solely as a facilitator between buyers and sellers.
        </p>
      ),
    },
    {
      id: "eligibility",
      title: "Eligibility",
      body: (
        <ul>
          <li>Users must be at least 18 years of age to register or make purchases.</li>
          <li>By using the Platform, you represent that you have the legal capacity to enter into a binding contract under applicable Indian laws.</li>
        </ul>
      ),
    },
    {
      id: "account",
      title: "User Account",
      body: (
        <ul>
          <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
          <li>All activities conducted through your account are your responsibility.</li>
          <li>KTMONA reserves the right to suspend or terminate accounts for suspicious, fraudulent, or abusive activity.</li>
        </ul>
      ),
    },
    {
      id: "vendor",
      title: "Vendor Participation",
      body: (
        <>
          <h3>Vendor Responsibilities</h3>
          <ul>
            <li>Provide accurate and complete product information.</li>
            <li>Ensure that products comply with all applicable laws and regulations.</li>
            <li>Uphold ethical sourcing, fair labor practices, and sustainability standards.</li>
            <li>Fulfill orders promptly and maintain quality standards.</li>
            <li>Handle returns, refunds, and customer service in accordance with platform policies.</li>
          </ul>
          <h3>Prohibited Products</h3>
          <ul>
            <li>Counterfeit or illegal items.</li>
            <li>Products that infringe intellectual property rights.</li>
            <li>Hazardous or restricted goods under Indian law.</li>
            <li>Any items that violate ethical or sustainability standards.</li>
          </ul>
          <h3>Commission and Fees</h3>
          <ul>
            <li>KTMONA may charge vendors a commission or service fee for each sale.</li>
            <li>Fees and payment terms will be outlined in a separate Vendor Agreement.</li>
          </ul>
        </>
      ),
    },
    {
      id: "listings",
      title: "Product Listings and Pricing",
      body: (
        <ul>
          <li>Product descriptions, pricing, and availability are the sole responsibility of the vendors.</li>
          <li>KTMONA does not guarantee the accuracy or completeness of product information.</li>
          <li>Prices are listed in Indian Rupees (INR) and are inclusive or exclusive of taxes as specified.</li>
          <li>Product color, texture, and appearance may slightly vary due to lighting, photography, or screen settings.</li>
          <li>Handmade or artisanal products may have slight variations and are not considered defects.</li>
          <li>Customers are advised to refer to size charts provided by vendors. KTMONA shall not be responsible for size mismatches.</li>
        </ul>
      ),
    },
    {
      id: "orders",
      title: "Orders and Payments",
      body: (
        <ul>
          <li>By placing an order, you agree to purchase the selected products subject to availability.</li>
          <li>Payments are processed through secure third-party payment gateways.</li>
          <li>KTMONA shall not be liable for failed transactions, payment gateway errors, unauthorized transactions, duplicate charges, or chargebacks arising due to third-party payment providers.</li>
          <li>KTMONA reserves the right to cancel orders in case of pricing or listing errors.</li>
        </ul>
      ),
    },
    {
      id: "shipping",
      title: "Shipping and Delivery",
      body: (
        <ul>
          <li>Shipping timelines and charges are determined by individual vendors.</li>
          <li>While KTMONA facilitates logistics, delivery timelines are estimates and not guaranteed.</li>
          <li>Risk of loss or damage passes to the customer upon successful delivery confirmation.</li>
        </ul>
      ),
    },
    {
      id: "returns",
      title: "Returns, Refunds, and Cancellations",
      body: (
        <ul>
          <li>Return and refund policies may vary by vendor but must comply with KTMONA’ minimum standards.</li>
          <li>Refunds are processed to the original payment method within 7-10 business days after approval.</li>
          <li>Orders may be cancelled before shipment; post-shipment cancellations will be treated as returns.</li>
        </ul>
      ),
    },
    {
      id: "ip",
      title: "Intellectual Property",
      body: (
        <ul>
          <li>All content on the Platform, including logos, text, graphics, and design elements, is the property of KTMONA or its licensors.</li>
          <li>Unauthorized use, reproduction, or distribution of any content is strictly prohibited.</li>
          <li>Vendors retain ownership of their product images and descriptions but grant KTMONA a non-exclusive license to use them for promotional purposes.</li>
        </ul>
      ),
    },
    {
      id: "ethical",
      title: "Ethical and Sustainability Commitment",
      body: (
        <ul>
          <li>KTMONA promotes fair trade and ethical sourcing.</li>
          <li>The Platform promotes environmentally sustainable materials and respect for traditional artisans and craftsmanship.</li>
          <li>Vendors found violating these principles may be removed from the Platform.</li>
        </ul>
      ),
    },
    {
      id: "prohibited",
      title: "Prohibited Activities",
      body: (
        <ul>
          <li>Engaging in fraudulent or deceptive practices.</li>
          <li>Uploading harmful or malicious content.</li>
          <li>Attempting to gain unauthorized access to the Platform.</li>
          <li>Violating any applicable local, national, or international laws.</li>
        </ul>
      ),
    },
    {
      id: "liability",
      title: "Limitation of Liability",
      body: (
        <ul>
          <li>KTMONA acts solely as a marketplace intermediary and is not liable for the quality, safety, or legality of products sold by vendors.</li>
          <li>To the maximum extent permitted by law, KTMONA shall not be liable for any indirect, incidental, or consequential damages arising from the use of the Platform.</li>
        </ul>
      ),
    },
    {
      id: "indemnification",
      title: "Indemnification",
      body: (
        <p>
          Users and vendors agree to indemnify and hold harmless KTMONA, its directors, employees, and affiliates from any claims, damages, or expenses arising from their breach of these Terms or violation of applicable laws.
        </p>
      ),
    },
    {
      id: "warranties",
      title: "Disclaimer of Warranties",
      body: (
        <p>
          All products and services are provided on an “as is” and “as available” basis without warranties of any kind, either express or implied, including but not limited to merchantability, fitness for a particular purpose, or non-infringement.
        </p>
      ),
    },
    {
      id: "privacy",
      title: "Privacy",
      body: (
        <ul>
          <li>Your use of the Platform is also governed by our Privacy Policy, which explains how we collect, use, and protect your personal information.</li>
          <li>We may use third-party analytics tools such as Google Analytics or advertising platforms for marketing and performance tracking.</li>
        </ul>
      ),
    },
    {
      id: "third-party",
      title: "Third-Party Links",
      body: (
        <p>
          The Platform may contain links to third-party websites. KTMONA is not responsible for the content or practices of such external sites.
        </p>
      ),
    },
    {
      id: "termination",
      title: "Termination",
      body: (
        <p>
          KTMONA reserves the right to suspend or terminate access to the Platform for any user or vendor who violates these Terms, without prior notice.
        </p>
      ),
    },
    {
      id: "law",
      title: "Governing Law and Jurisdiction",
      body: (
        <ul>
          <li>These Terms shall be governed by and construed in accordance with the laws of India.</li>
          <li>Any dispute arising out of or relating to these Terms shall first be attempted to be resolved amicably. If unresolved, the dispute shall be referred to arbitration under the Arbitration and Conciliation Act, 1996. The seat of arbitration shall be Faridabad, Haryana.</li>
        </ul>
      ),
    },
    {
      id: "amendments",
      title: "Amendments",
      body: (
        <p>
          KTMONA reserves the right to update or modify these Terms at any time. Continued use of the Platform after such changes constitutes acceptance of the revised Terms.
        </p>
      ),
    },
    {
      id: "force-majeure",
      title: "Force Majeure",
      body: (
        <>
          <p>
            KTMONA shall not be liable for failure or delay in performance due to events beyond its reasonable control, including natural disasters, pandemics, strikes, governmental actions, or technical failures including internet failures, platform downtime, or cyber incidents.
          </p>
          <p>
            KTMONA does not guarantee uninterrupted or error-free operation of the Platform and shall not be liable for any temporary unavailability due to maintenance, technical issues, or system failures.
          </p>
        </>
      ),
    },
    {
      id: "contact",
      title: "Contact Information",
      body: (
        <>
          <p>
            For grievance-related matters, please contact our designated Grievance Officer:
          </p>
          <ul>
            <li>Grievance Officer: KTMONA Grievance Desk</li>
            <li>Email: monika99skb@gmail.com</li>
            <li>Response Time: Within 48 hours acknowledgment, 15 days resolution</li>
          </ul>
          <p>
            For any questions or concerns regarding these Terms, please contact KTMONA at monika99skb@gmail.com, 8766211837, or KTMONA, A-740, Vinay Nagar, Agwanpur, Faridabad, Haryana 121013, India.
          </p>
        </>
      ),
    },
  ],
};

export const privacyPolicy: PolicyDocument = {
  title: "Privacy Policy",
  lastUpdated: "01 April 2026",
  intro: (
    <p>
      KTMONA is committed to protecting your privacy and ensuring that your personal information is handled safely and responsibly.
    </p>
  ),
  sections: [
    {
      id: "intro",
      title: "Introduction",
      body: (
        <p>
          This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit www.ktmona.com and use the Platform.
        </p>
      ),
    },
    {
      id: "information",
      title: "Information We Collect",
      body: (
        <>
          <h3>Personal Information</h3>
          <ul>
            <li>Full Name</li>
            <li>Email Address</li>
            <li>Phone Number</li>
            <li>Shipping and Billing Address</li>
            <li>Payment Information processed securely via third-party gateways</li>
            <li>Account Login Details</li>
          </ul>
          <h3>Non-Personal Information</h3>
          <ul>
            <li>IP Address</li>
            <li>Browser Type and Device Information</li>
            <li>Pages Visited and Time Spent</li>
            <li>Cookies and Tracking Technologies</li>
          </ul>
          <h3>Vendor Information</h3>
          <ul>
            <li>Business Name and Registration Details</li>
            <li>GSTIN and PAN</li>
            <li>Bank Account Information</li>
            <li>Product Listings and Transaction History</li>
          </ul>
        </>
      ),
    },
    {
      id: "use",
      title: "How We Use Your Information",
      body: (
        <ul>
          <li>Process and fulfill orders</li>
          <li>Facilitate vendor onboarding and payments</li>
          <li>Provide customer support</li>
          <li>Improve website functionality and user experience</li>
          <li>Send transactional and promotional communications</li>
          <li>Prevent fraud and enhance security</li>
          <li>Comply with legal obligations</li>
        </ul>
      ),
    },
    {
      id: "sharing",
      title: "Sharing of Information",
      body: (
        <>
          <p>
            We may share your information with vendors to fulfill orders, payment gateways for secure transactions, logistics partners for shipping and delivery, legal authorities when required by law, and service providers assisting in website operations.
          </p>
          <p>
            KTMONA complies with Consumer Protection (E-Commerce) Rules, 2020, including seller details visibility, country of origin disclosure, and complaint mechanism requirements.
          </p>
          <p>
            We do not sell or rent your personal information to third parties.
          </p>
        </>
      ),
    },
    {
      id: "cookies",
      title: "Cookies Policy",
      body: (
        <p>
          We use cookies to enhance user experience and analyze website traffic. Users may modify browser settings to decline cookies; however, some features of the Platform may not function properly.
        </p>
      ),
    },
    {
      id: "security",
      title: "Data Security",
      body: (
        <p>
          We implement reasonable administrative, technical, and physical safeguards to protect your personal information. While we strive to protect your data, no method of transmission over the internet is 100% secure. In the event of a data breach, we will notify affected users in accordance with applicable laws.
        </p>
      ),
    },
    {
      id: "retention",
      title: "Data Retention",
      body: (
        <p>
          Your personal data will be retained only for as long as necessary to fulfill the purposes outlined in this policy or as required by law.
        </p>
      ),
    },
    {
      id: "rights",
      title: "User Rights",
      body: (
        <ul>
          <li>Access and review personal data</li>
          <li>Request corrections or updates</li>
          <li>Withdraw consent for marketing communications</li>
          <li>Request deletion of data, subject to legal obligations</li>
        </ul>
      ),
    },
    {
      id: "children",
      title: "Children’s Privacy",
      body: (
        <p>
          Our services are not intended for individuals under the age of 18, and we do not knowingly collect personal information from minors.
        </p>
      ),
    },
    {
      id: "changes",
      title: "Changes to This Policy",
      body: (
        <p>
          We reserve the right to update this Privacy Policy at any time. Changes will be posted on this page with an updated effective date.
        </p>
      ),
    },
    {
      id: "contact",
      title: "Contact Us",
      body: (
        <>
          <p>KTMONA</p>
          <ul>
            <li>Email: monika99skb@gmail.com</li>
            <li>Phone: 8766211837</li>
            <li>Address: KTMONA, A-740, Vinay Nagar, Agwanpur, Faridabad, Haryana 121013, India.</li>
          </ul>
          <p>
            For grievance matters, contact the KTMONA Grievance Desk at monika99skb@gmail.com. Response time: within 48 hours acknowledgment, 15 days resolution.
          </p>
        </>
      ),
    },
  ],
};

export const returnPolicy: PolicyDocument = {
  title: "Return & Refund Policy",
  lastUpdated: "01 April 2026",
  intro: (
    <p>
      KTMONA is a multi-vendor marketplace. Return and refund processes are managed in collaboration with individual vendors while maintaining a consistent customer experience.
    </p>
  ),
  sections: [
    {
      id: "overview",
      title: "Overview",
      body: (
        <p>
          Customers may request a return or refund according to the conditions below. Vendor-specific policies may apply, but they must meet KTMONA’ minimum standards.
        </p>
      ),
    },
    {
      id: "eligibility",
      title: "Eligibility for Returns",
      body: (
        <ul>
          <li>The product is damaged, defective, or incorrect.</li>
          <li>The product differs significantly from its description.</li>
          <li>The return request is raised within 7 days of delivery.</li>
        </ul>
      ),
    },
    {
      id: "process",
      title: "Return Process",
      body: (
        <ol>
          <li>Log in to your account and navigate to My Orders.</li>
          <li>Select the item and click Request Return.</li>
          <li>Provide the reason and upload supporting images.</li>
          <li>Once approved, a pickup will be scheduled.</li>
        </ol>
      ),
    },
    {
      id: "refunds",
      title: "Refunds",
      body: (
        <>
          <ul>
            <li>Refunds are initiated after the returned product passes quality inspection.</li>
            <li>The amount will be credited to the original payment method within 7-10 business days.</li>
            <li>For Cash on Delivery (COD) orders, refunds will be processed to the customer’s bank account.</li>
          </ul>
          <p className="rounded-md border-l-4 border-brand bg-brand/10 px-4 py-3 font-semibold text-ink">
            Exchange/Replacement deliveries will be done within 5-7 business days.
          </p>
        </>
      ),
    },
    {
      id: "contact",
      title: "Contact Us",
      body: (
        <p>
          For return or refund help, email monika99skb@gmail.com or call 8766211837.
        </p>
      ),
    },
  ],
};

export const refundPolicy: PolicyDocument = {
  title: "Refund Policy",
  lastUpdated: "01 April 2026",
  intro: (
    <p>
      Refunds are credited after approval to the original payment method within the stated timeline.
    </p>
  ),
  sections: [
    {
      id: "refunds",
      title: "Refund Processing",
      body: (
        <>
          <ul>
            <li>Refunds are issued after the return is approved or an eligible cancellation is confirmed.</li>
            <li>Approved refunds are credited to the original payment method within 7-10 business days.</li>
            <li>COD refunds are issued to the customer’s bank account after verification.</li>
          </ul>
          <p className="rounded-md border-l-4 border-brand bg-brand/10 px-4 py-3 font-semibold text-ink">
            Exchange/Replacement deliveries will be done within 5-7 business days.
          </p>
        </>
      ),
    },
    {
      id: "support",
      title: "Support",
      body: (
        <p>
          If a refund is delayed beyond the normal window, please contact monika99skb@gmail.com with your order ID and payment reference.
        </p>
      ),
    },
  ],
};

export const shippingPolicy: PolicyDocument = {
  title: "Shipping & Delivery Policy",
  lastUpdated: "01 April 2026",
  intro: (
    <p>
      KTMONA collaborates with trusted logistics partners to deliver products across India. Shipping timelines may vary by vendor.
    </p>
  ),
  sections: [
    {
      id: "processing",
      title: "Order Processing",
      body: (
        <ul>
          <li>Orders are typically processed within 1-3 business days after confirmation.</li>
          <li>Vendors are responsible for packaging and dispatching the products.</li>
        </ul>
      ),
    },
    {
      id: "delivery",
      title: "Delivery Timelines",
      body: (
        <ul>
          <li>Metro Cities: 3-5 business days</li>
          <li>Non-Metro Cities: 5-7 business days</li>
          <li>Remote Areas: 7-10 business days</li>
        </ul>
      ),
    },
    {
      id: "charges",
      title: "Shipping Charges",
      body: (
        <p>
          Shipping charges, if applicable, are displayed at checkout. Free shipping may be offered during promotional campaigns.
        </p>
      ),
    },
    {
      id: "tracking",
      title: "Order Tracking",
      body: (
        <p>
          Customers will receive tracking details via SMS and email once the order is shipped.
        </p>
      ),
    },
    {
      id: "cod",
      title: "Cash on Delivery",
      body: (
        <p>
          COD is available for selected pin codes. KTMONA reserves the right to limit or cancel COD orders, especially for high-value or suspected fraudulent transactions.
        </p>
      ),
    },
    {
      id: "delays",
      title: "Delivery Delays",
      body: (
        <ul>
          <li>Natural disasters or force majeure events</li>
          <li>Government restrictions</li>
          <li>Logistics partner issues</li>
          <li>Incorrect shipping information provided by the customer</li>
        </ul>
      ),
    },
    {
      id: "contact",
      title: "Contact Us",
      body: (
        <p>
          For shipping-related questions, email monika99skb@gmail.com or call 8766211837.
        </p>
      ),
    },
  ],
};

export const vendorAgreementPolicy: PolicyDocument = {
  title: "Vendor Agreement",
  lastUpdated: "01 April 2026",
  intro: (
    <p>
      This summary version describes the core vendor obligations, compliance requirements, and settlement terms that apply to sellers on KTMONA.
    </p>
  ),
  sections: [
    {
      id: "eligibility",
      title: "Eligibility",
      body: (
        <p>
          Vendors must be legally registered businesses in India and comply with all applicable laws, including GST regulations.
        </p>
      ),
    },
    {
      id: "obligations",
      title: "Vendor Obligations",
      body: (
        <ul>
          <li>Provide accurate product information and pricing.</li>
          <li>Ensure ethical sourcing and fair labor practices.</li>
          <li>Maintain adequate inventory levels.</li>
          <li>Dispatch orders within specified timelines.</li>
          <li>Handle returns and customer service efficiently.</li>
        </ul>
      ),
    },
    {
      id: "commission",
      title: "Commission and Fees",
      body: (
        <ul>
          <li>KTMONA will charge a commission on each successful sale.</li>
          <li>Payment settlements will be made within 7-15 business days after order completion, subject to deductions for returns or cancellations.</li>
        </ul>
      ),
    },
    {
      id: "ip",
      title: "Intellectual Property",
      body: (
        <p>
          Vendors retain ownership of their trademarks and product images but grant KTMONA a non-exclusive, royalty-free license to use them for promotional purposes.
        </p>
      ),
    },
    {
      id: "prohibited",
      title: "Prohibited Activities",
      body: (
        <ul>
          <li>Sell counterfeit or illegal products.</li>
          <li>Violate intellectual property rights.</li>
          <li>Engage in misleading or deceptive practices.</li>
        </ul>
      ),
    },
    {
      id: "ethics",
      title: "Compliance with Ethical Standards",
      body: (
        <p>
          KTMONA promotes sustainability and ethical sourcing. Vendors found violating these principles may face suspension or termination.
        </p>
      ),
    },
    {
      id: "termination",
      title: "Termination",
      body: (
        <p>
          Either party may terminate the agreement with 30 days’ written notice. Immediate termination may occur in cases of legal violations or policy breaches.
        </p>
      ),
    },
    {
      id: "indemnification",
      title: "Indemnification",
      body: (
        <p>
          Vendors agree to indemnify and hold KTMONA harmless from any claims arising from their products or actions.
        </p>
      ),
    },
    {
      id: "legal",
      title: "Legal and Compliance",
      body: (
        <p>
          GST invoicing responsibility will be with the vendor and all product prices will include GST as applicable on the products.
        </p>
      ),
    },
    {
      id: "law",
      title: "Governing Law",
      body: (
        <p>
          This Agreement shall be governed by the laws of India, with jurisdiction in Faridabad, Haryana.
        </p>
      ),
    },
    {
      id: "contact",
      title: "Contact Information",
      body: (
        <p>
          For vendor inquiries, email monika99skb@gmail.com or call 8766211837. Address: KTMONA, A-740, Vinay Nagar, Agwanpur, Faridabad, Haryana 121013, India.
        </p>
      ),
    },
  ],
};
