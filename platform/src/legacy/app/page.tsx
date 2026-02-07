import Link from 'next/link';
import { Bot, Zap, Globe, Shield, MessageSquare, Code } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 bg-black/50 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Bot size={24} />
            </div>
            <span className="text-2xl font-black tracking-tighter">nanobot<span className="text-blue-500">SaaS</span></span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <Link href="#features" className="nav-link">Features</Link>
            <Link href="#pricing" className="nav-link">Pricing</Link>
            <Link href="/login" className="nav-link">Login</Link>
            <Link href="/register" className="btn-primary">Get Started</Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-40 pb-20 px-6">
        <div className="max-width-7xl mx-auto text-center">
          <div className="inline-block px-4 py-1.5 mb-6 glass-card border-blue-500/30">
            <span className="text-sm font-bold text-blue-400">✨ v1.0.0 is now live</span>
          </div>
          <h1 className="text-6xl md:text-8xl font-black tracking-tight mb-8 leading-[1.1]">
            Deploy Your Private <br />
            <span className="gradient-text">AI Assistant</span> in Seconds
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-12">
            Register, connect your favorite provider, choose your channel, and let nanobot handle the rest. Now with built-in Browser Automation.
          </p>
          <div className="flex flex-col md:flex-row items-center justify-center gap-6">
            <Link href="/register" className="btn-primary flex items-center gap-2 px-8 py-4 text-lg">
              Start Free Trial <Zap size={20} fill="currentColor" />
            </Link>
            <Link href="https://github.com/HKUDS/nanobot" className="btn-secondary px-8 py-4 text-lg">
              View Source
            </Link>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              icon={<Globe className="text-blue-500" />}
              title="Browser Skills"
              description="Powered by Playwright. Automate web tasks, take screenshots, and interact with dynamic sites automatically."
            />
            <FeatureCard
              icon={<Shield className="text-purple-500" />}
              title="Private & Secure"
              description="Your API keys are encrypted. Each bot runs in its own isolated environment for maximum security."
            />
            <FeatureCard
              icon={<MessageSquare className="text-green-500" />}
              title="Multi-Channel"
              description="Connect to Discord, Telegram, WhatsApp, or Feishu. Reach your assistant wherever you are."
            />
            <FeatureCard
              icon={<Zap className="text-yellow-500" />}
              title="Instant Deployment"
              description="One-click setup. No coding required. Start chatting with your personal bot in under 2 minutes."
            />
            <FeatureCard
              icon={<Code className="text-red-500" />}
              title="Model Choice"
              description="Supports OpenAI, Anthropic, Gemini, DeepSeek, and local models via vLLM."
            />
            <FeatureCard
              icon={<Bot className="text-cyan-500" />}
              title="Tool Registry"
              description="Extend your bot with custom skills for GitHub, weather, tmux, and more."
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 border-t border-white/5 bg-black/50">
        <div className="max-w-7xl mx-auto px-6 text-center text-gray-500">
          <p>© 2026 nanobot SaaS. Built with passion for the AI community.</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="p-8 glass-card">
      <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center mb-6">
        {icon}
      </div>
      <h3 className="text-2xl font-bold mb-4">{title}</h3>
      <p className="text-gray-400 leading-relaxed">
        {description}
      </p>
    </div>
  );
}
