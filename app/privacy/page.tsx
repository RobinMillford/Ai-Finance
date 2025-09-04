"use client";

import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Shield } from "lucide-react";

export default function PrivacyPage() {
  const policies = [
    {
      title: "Information We Collect",
      content: `
        <p>We collect information you provide directly to us, such as when you create an account, subscribe to our services, or contact us for support. This may include:</p>
        <ul class="list-disc pl-6 mt-2 space-y-1">
          <li>Name, email address, and contact information</li>
          <li>Payment information for subscription services</li>
          <li>Financial portfolio data you choose to share with us</li>
          <li>Communication preferences and settings</li>
        </ul>
        <p class="mt-4">We also automatically collect certain information when you use our services:</p>
        <ul class="list-disc pl-6 mt-2 space-y-1">
          <li>Device and browser information</li>
          <li>IP address and geolocation data</li>
          <li>Usage statistics and interaction data</li>
          <li>Cookies and similar tracking technologies</li>
        </ul>
      `
    },
    {
      title: "How We Use Your Information",
      content: `
        <p>We use the information we collect to:</p>
        <ul class="list-disc pl-6 mt-2 space-y-1">
          <li>Provide, maintain, and improve our services</li>
          <li>Personalize your experience and deliver relevant content</li>
          <li>Process transactions and send transactional communications</li>
          <li>Respond to your inquiries and provide customer support</li>
          <li>Send you technical notices, updates, and security alerts</li>
          <li>Monitor and analyze usage patterns and trends</li>
          <li>Protect the security and integrity of our platform</li>
        </ul>
      `
    },
    {
      title: "Data Sharing and Disclosure",
      content: `
        <p>We do not sell, trade, or rent your personal information to third parties. We may share your information in the following circumstances:</p>
        <ul class="list-disc pl-6 mt-2 space-y-1">
          <li>With your consent or at your direction</li>
          <li>To comply with legal obligations or respond to lawful requests</li>
          <li>To protect our rights, property, or safety, or that of our users</li>
          <li>In connection with a business transfer, merger, or acquisition</li>
          <li>With service providers who assist us in operating our platform</li>
        </ul>
        <p class="mt-4">Our service providers are contractually obligated to protect your information and may only use it for the purposes we specify.</p>
      `
    },
    {
      title: "Data Security",
      content: `
        <p>We implement industry-standard security measures to protect your information, including:</p>
        <ul class="list-disc pl-6 mt-2 space-y-1">
          <li>Encryption of data in transit and at rest</li>
          <li>Regular security assessments and penetration testing</li>
          <li>Access controls and authentication mechanisms</li>
          <li>Employee training on data protection practices</li>
        </ul>
        <p class="mt-4">While we strive to protect your information, no method of transmission over the Internet or electronic storage is 100% secure. We cannot guarantee absolute security.</p>
      `
    },
    {
      title: "Your Rights and Choices",
      content: `
        <p>You have certain rights regarding your personal information:</p>
        <ul class="list-disc pl-6 mt-2 space-y-1">
          <li>Access and receive a copy of your personal data</li>
          <li>Correct or update inaccurate information</li>
          <li>Request deletion of your personal data</li>
          <li>Object to or restrict processing of your data</li>
          <li>Withdraw consent for data processing</li>
          <li>Data portability to other services</li>
        </ul>
        <p class="mt-4">To exercise these rights, please contact us using the information provided below. We will respond to your request within 30 days.</p>
      `
    },
    {
      title: "Data Retention",
      content: `
        <p>We retain your personal information for as long as necessary to provide our services and fulfill the purposes outlined in this policy, including:</p>
        <ul class="list-disc pl-6 mt-2 space-y-1">
          <li>As long as you maintain an active account</li>
          <li>To comply with legal obligations</li>
          <li>To resolve disputes and enforce agreements</li>
          <li>To prevent fraud and abuse</li>
        </ul>
        <p class="mt-4">When we no longer need your information, we will securely delete it in accordance with our retention policy.</p>
      `
    },
    {
      title: "International Data Transfers",
      content: `
        <p>If you are accessing our services from outside the United States, please note that your information may be transferred to, stored, and processed in the United States where our servers are located.</p>
        <p class="mt-4">We take appropriate measures to ensure that your information receives an adequate level of protection in accordance with applicable laws, including through standard contractual clauses approved by relevant authorities.</p>
      `
    },
    {
      title: "Children's Privacy",
      content: `
        <p>Our services are not directed to individuals under the age of 18. We do not knowingly collect personal information from children under 18. If we become aware that we have collected personal information from a child under 18, we will take steps to delete such information.</p>
      `
    },
    {
      title: "Changes to This Policy",
      content: `
        <p>We may update this Privacy Policy from time to time to reflect changes in our practices or for other operational, legal, or regulatory reasons. We will notify you of any material changes by posting the updated policy on this page and updating the "Last Updated" date.</p>
        <p class="mt-4">We encourage you to review this policy periodically to stay informed about how we are protecting your information.</p>
      `
    },
    {
      title: "Contact Us",
      content: `
        <p>If you have any questions about this Privacy Policy or our data practices, please contact us at:</p>
        <div class="mt-4 p-4 bg-muted rounded-lg">
          <p class="font-semibold">FinanceAI Privacy Team</p>
          <p>Email: privacy@financeai.com</p>
          <p>Address: New York, NY 10001, United States</p>
        </div>
        <p class="mt-4">You may also contact us through our website's contact form or by mail at the address above.</p>
      `
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <section className="text-center py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="flex justify-center mb-6">
              <div className="p-4 rounded-full bg-primary/10">
                <Shield className="h-12 w-12 text-primary" />
              </div>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-6">Privacy Policy</h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Your privacy is important to us. This policy explains how we collect, use, and protect your information.
            </p>
            <p className="text-muted-foreground mt-4">Last Updated: September 4, 2025</p>
          </motion.div>
        </section>

        {/* Policy Content */}
        <div className="space-y-8">
          {policies.map((policy, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Card className="p-8">
                <h2 className="text-2xl font-bold mb-4">{index + 1}. {policy.title}</h2>
                <div 
                  className="text-muted-foreground prose prose-headings:text-foreground prose-strong:text-foreground max-w-none"
                  dangerouslySetInnerHTML={{ __html: policy.content }}
                />
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Effective Date */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center py-12"
        >
          <p className="text-muted-foreground">
            This Privacy Policy is effective as of September 4, 2025.
          </p>
        </motion.div>
      </div>
    </div>
  );
}