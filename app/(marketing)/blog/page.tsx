import Link from 'next/link';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { SiteNav } from "@/components/ui/site-nav";
import { WaitlistTrigger } from "@/components/ui/waitlist-trigger";

const articleStyles = `
  .article-content h2 { font-size: 1.75rem; font-weight: 700; margin-top: 2.5rem; margin-bottom: 1rem; color: #111827; }
  .article-content h3 { font-size: 1.375rem; font-weight: 600; margin-top: 1.75rem; margin-bottom: 0.75rem; color: #1f2937; }
  .article-content p { font-size: 1.125rem; line-height: 1.8; margin-bottom: 1.25rem; color: #374151; }
  .article-content ul, .article-content ol { font-size: 1.125rem; line-height: 1.8; margin-bottom: 1.25rem; color: #374151; padding-left: 1.5rem; }
  .article-content li { margin-bottom: 0.5rem; }
  .article-content blockquote { border-left: 4px solid #00B2FF; padding-left: 1.5rem; margin: 1.5rem 0; font-style: italic; color: #4b5563; }
  .article-content .stat-box { background: #f9fafb; border: 1px solid #e5e5e5; border-radius: 12px; padding: 1.5rem; margin: 1.5rem 0; }
  .article-content .stat-box .stat { font-size: 2.25rem; font-weight: 700; color: #00B2FF; display: block; }
  .article-content .stat-box .stat-label { font-size: 1rem; color: #6b7280; display: block; margin-top: 0.25rem; }
  .article-content a { color: #00B2FF; text-decoration: underline; }
  .btn-primary { background: #00B2FF; color: #fff; border: 1px solid #00B2FF; transition: all 0.2s ease; border-radius: 8px; }
  .btn-primary:hover { background: transparent; color: #00B2FF; }
`;

function getBlogPosts() {
  const postsDir = path.join(process.cwd(), 'app', '(marketing)', 'blog', 'posts');

  if (!fs.existsSync(postsDir)) {
    return [];
  }

  const files = fs.readdirSync(postsDir)
    .filter(file => file.endsWith('.md'))
    .sort()
    .reverse();

  return files.map(file => {
    const filePath = path.join(postsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const { data, content: body } = matter(content);

    return {
      slug: file.replace('.md', ''),
      title: data.title || 'Untitled',
      date: data.date || new Date(),
      excerpt: data.excerpt || body.substring(0, 200),
      body,
      author: data.author || 'SynthForce'
    };
  });
}

export default function BlogPage() {
  const posts = getBlogPosts();
  const latestPost = posts[0];

  return (
    <div className="bg-paper text-void font-sans">
      <style dangerouslySetInnerHTML={{ __html: articleStyles }} />

      <SiteNav />

      <main className="pb-20">
        <div className="bg-gray-50 border-b border-subtle py-20">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <p className="text-sm uppercase tracking-widest text-gray-500 mb-6">Blog</p>
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
              Insights on Managing Your Synthetic Workforce
            </h1>
            <p className="text-xl text-gray-600">
              Thoughts on AI agent operations, cost optimization, policy enforcement, and building the HR layer for AI.
            </p>
          </div>
        </div>

        {latestPost ? (
          <div className="max-w-5xl mx-auto px-6 py-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-10 text-center">Latest Post</h2>
            <div className="bg-white border border-gray-200 rounded-2xl p-10 hover:shadow-lg transition">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xs uppercase tracking-wider text-green-600 font-semibold bg-green-50 px-3 py-1 rounded-full">
                  Published {new Date(latestPost.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
              </div>
              <h3 className="text-3xl font-bold text-gray-900 mb-4">
                <a href={`#${latestPost.slug}`} className="hover:text-accent transition">
                  {latestPost.title}
                </a>
              </h3>
              <p className="text-lg text-gray-600 mb-6">{latestPost.excerpt}</p>
              <a href={`#${latestPost.slug}`} className="text-accent hover:underline font-medium">
                Read the full post →
              </a>
            </div>
          </div>
        ) : null}

        <div className="max-w-5xl mx-auto px-6 py-10 mb-10">
          <h2 className="text-3xl font-bold text-gray-900 mb-10 text-center">Upcoming Topics</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="border border-gray-200 rounded-2xl p-8 hover:shadow-lg transition">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xs uppercase tracking-wider text-accent font-semibold">Coming Soon</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">The Cost of Runaway Agents</h3>
              <p className="text-gray-600">
                An analysis of real-world AI agent cost overruns, why they happen, and how to prevent them.
                Why companies with 50+ agents see 15%+ API spend waste from runaway loops and zombie processes.
              </p>
            </div>
            <div className="border border-gray-200 rounded-2xl p-8 hover:shadow-lg transition">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xs uppercase tracking-wider text-accent font-semibold">Coming Soon</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Why You Need an Org Chart for Your AI Agents</h3>
              <p className="text-gray-600">
                A framework for assigning business owners, departments, and roles to synthetic employees.
                Move beyond SLAs to actual management.
              </p>
            </div>
            <div className="border border-gray-200 rounded-2xl p-8 hover:shadow-lg transition">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xs uppercase tracking-wider text-accent font-semibold">Coming Soon</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Policies Every AI Agent Needs</h3>
              <p className="text-gray-600">
                From no-PII rules to refund guardrails: the policies that prevent silent liability.
                A checklist for anyone deploying AI agents in customer-facing roles.
              </p>
            </div>
            <div className="border border-gray-200 rounded-2xl p-8 hover:shadow-lg transition">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xs uppercase tracking-wider text-accent font-semibold">Coming Soon</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">AI Agent ROI: A Calculator Framework</h3>
              <p className="text-gray-600">
                How to measure whether your sales bot, support bot, or coding bot is actually worth what it costs.
                A practical framework for non-technical managers.
              </p>
            </div>
            <div className="border border-gray-200 rounded-2xl p-8 hover:shadow-lg transition bg-gray-50 border-dashed">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Future</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">More to come...</h3>
              <p className="text-gray-600">
                We are building the knowledge base for the age of synthetic work. Subscribe to follow along.
              </p>
            </div>
          </div>
        </div>

        {latestPost && (
          <article id={latestPost.slug} className="max-w-3xl mx-auto px-6 scroll-mt-20">
            <div className="pt-10 pb-6">
              <Link href="/blog" className="text-accent hover:underline text-sm">
                &larr; Back to Blog
              </Link>
            </div>
            <div className="mb-10">
              <p className="text-sm uppercase tracking-widest text-gray-500 mb-4">
                {new Date(latestPost.date).toLocaleDateString()}
              </p>
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 leading-tight">
                {latestPost.title}
              </h1>
              <p className="text-xl text-gray-600 mb-8">{latestPost.excerpt}</p>
            </div>
            <div className="article-content" dangerouslySetInnerHTML={{ __html: latestPost.body }} />
            <div className="border-t border-subtle pt-10 mt-10">
              <div className="bg-gray-50 rounded-2xl p-8 text-center">
                <h3 className="text-2xl font-bold text-gray-900 mb-4">
                  SynthForce is the HR platform for AI agents.
                </h3>
                <p className="text-gray-600 mb-6">
                  Onboard, measure, and govern your synthetic workforce. Join the waitlist for early access.
                </p>
                <WaitlistTrigger className="btn-primary px-8 py-4 font-sans font-semibold text-sm uppercase rounded-lg inline-block cursor-pointer">
                  Join Waitlist
                </WaitlistTrigger>
                <p className="mt-4 text-sm text-gray-500">
                  Or <Link href="/demo" className="text-accent hover:underline">see the demo</Link>.
                </p>
              </div>
            </div>
          </article>
        )}
      </main>

    </div>
  );
}
