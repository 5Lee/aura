import Link from "next/link"
import { ThemeToggle } from "@/components/theme/theme-toggle"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 dark:from-primary/10 dark:via-background dark:to-secondary/10">
      {/* Header */}
      <header className="border-b glass sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-gradient-primary hover:opacity-80 transition-opacity">
            Aura
          </Link>
          <nav className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/browse"
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted"
            >
              浏览
            </Link>
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted"
            >
              登录
            </Link>
            <Link
              href="/register"
              className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all shadow-primary hover:shadow-lg btn-press"
            >
              注册
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-16 md:py-24 text-center">
        <div className="max-w-4xl mx-auto animate-fade-in">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 dark:bg-primary/20 rounded-full text-sm text-primary font-medium mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            AI 提示词管理平台
          </div>

          {/* Title */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
            <span className="text-gradient-primary">收集、管理、分享</span>
            <br />
            <span className="text-foreground">你的 AI 提示词</span>
          </h1>

          {/* Description */}
          <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
            一个强大的 AI 提示词管理工具，帮助你组织、优化和分享你精心设计的提示词，提升 AI 交互效率。
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register"
              className="inline-flex items-center justify-center px-8 py-4 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-all shadow-primary hover:shadow-xl hover:scale-105 btn-press"
            >
              免费开始使用
              <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <Link
              href="/browse"
              className="inline-flex items-center justify-center px-8 py-4 bg-card text-card-foreground rounded-xl font-semibold hover:bg-muted transition-all border border-border shadow-card hover:shadow-card-hover"
            >
              浏览提示词
              <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-6 mt-20 max-w-5xl mx-auto">
          {/* Feature 1 */}
          <div className="group p-6 bg-card rounded-2xl shadow-card border border-border hover:shadow-card-hover hover:border-primary/20 transition-all card-hover">
            <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
              <svg className="w-7 h-7 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-3 text-card-foreground">智能分类</h3>
            <p className="text-muted-foreground leading-relaxed">
              用分类和标签组织你的提示词，快速找到需要的内容
            </p>
          </div>

          {/* Feature 2 */}
          <div className="group p-6 bg-card rounded-2xl shadow-card border border-border hover:shadow-card-hover hover:border-secondary/20 transition-all card-hover">
            <div className="w-14 h-14 bg-secondary/10 rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
              <svg className="w-7 h-7 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-3 text-card-foreground">收藏管理</h3>
            <p className="text-muted-foreground leading-relaxed">
              收藏喜欢的提示词，创建个人收藏夹
            </p>
          </div>

          {/* Feature 3 */}
          <div className="group p-6 bg-card rounded-2xl shadow-card border border-border hover:shadow-card-hover hover:border-accent/20 transition-all card-hover">
            <div className="w-14 h-14 bg-accent/10 rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
              <svg className="w-7 h-7 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-3 text-card-foreground">社区分享</h3>
            <p className="text-muted-foreground leading-relaxed">
              分享优质提示词，发现社区宝藏
            </p>
          </div>
        </div>

        {/* Stats Section */}
        <div className="mt-20 py-12 border-t border-border">
          <div className="max-w-4xl mx-auto grid grid-cols-3 gap-8 text-center">
            <div className="animate-slide-up" style={{ animationDelay: '0ms' }}>
              <div className="text-3xl md:text-4xl font-bold text-gradient-primary mb-2">100+</div>
              <div className="text-sm text-muted-foreground">提示词模板</div>
            </div>
            <div className="animate-slide-up" style={{ animationDelay: '100ms' }}>
              <div className="text-3xl md:text-4xl font-bold text-gradient-primary mb-2">50+</div>
              <div className="text-sm text-muted-foreground">活跃用户</div>
            </div>
            <div className="animate-slide-up" style={{ animationDelay: '200ms' }}>
              <div className="text-3xl md:text-4xl font-bold text-gradient-primary mb-2">10+</div>
              <div className="text-sm text-muted-foreground">分类标签</div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-8 mt-12">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2026 Aura. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}