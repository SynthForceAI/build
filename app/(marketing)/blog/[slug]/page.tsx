import Link from 'next/link';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { notFound } from 'next/navigation';
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

function getPostsDir() {
  return path.join(process.cwd(), 'app', '(marketing)', 'blog', 'posts');
}

function getAllPosts() {
  const postsDir = getPostsDir();
  if (!fs.existsSync(postsDir)) return [];
  return fs.readdirSync(postsDir)
    .filter(f => f.endsWith('.md'))
    .sort()
    .reverse()
    .map(file => {
      const { data, content: body } = matter(fs.readFileSync(path.join(postsDir, file), 'utf-8'));
      return {
        slug: file.replace('.md', ''),
        title: data.title || 'Untitled',
        date: data.date || new Date(),
        excerpt: data.excerpt || body.substring(0, 200),
        body,
        author: data.author || 'SynthForce',
      };
    });
}

function ordinalDate(date: Date): string {
  const day = date.getDate();
  const suffix = [11, 12, 13].includes(day) ? 'th'
    : day % 10 === 1 ? 'st'
    : day % 10 === 2 ? 'nd'
    : day % 10 === 3 ? 'rd'
    : 'th';
  return `${day}${suffix} ${date.toLocaleDateString('en-US', { month: 'long' })}`;
}

export async function generateStaticParams() {
  const postsDir = getPostsDir();
  if (!fs.existsSync(postsDir)) return [];
  return fs.readdirSync(postsDir)
    .filter(f => f.endsWith('.md'))
    .map(f => ({ slug: f.replace('.md', '') }));
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const posts = getAllPosts();
  const post = posts.find(p => p.slug === slug);
  if (!post) notFound();

  return (
    <div className="bg-paper text-void font-sans">
      <style dangerouslySetInnerHTML={{ __html: articleStyles }} />
      <SiteNav />

      <main className="pb-20">
        <div className="bg-gray-50 border-b border-subtle py-12">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <p className="text-sm uppercase tracking-widest text-gray-500 mb-4">Blog</p>
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 leading-tight">
              {post.title}
            </h1>
            <p className="text-gray-500 text-sm">
              {new Date(post.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              {post.author ? ` · ${post.author}` : ''}
            </p>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-12 flex gap-10 items-start">

          {/* Left sidebar */}
          <aside className="w-52 flex-shrink-0 sticky top-8 self-start border-r border-gray-100 pr-8">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-5">All Posts</p>
            <div className="space-y-5">
              {posts.map(p => (
                <Link
                  key={p.slug}
                  href={`/blog/${p.slug}`}
                  className={`block group ${p.slug === slug ? 'opacity-100' : ''}`}
                >
                  <p className={`text-sm font-semibold leading-snug transition ${
                    p.slug === slug
                      ? 'text-accent'
                      : 'text-gray-800 group-hover:text-accent'
                  }`}>
                    {p.title.split(' ').slice(0, 5).join(' ')}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">{ordinalDate(new Date(p.date))}</p>
                </Link>
              ))}
            </div>
          </aside>

          {/* Article */}
          <div className="flex-1 min-w-0">
            <div className="pb-6">
              <Link href="/blog" className="text-accent hover:underline text-sm">
                &larr; Back to Blog
              </Link>
            </div>
            <div className="article-content" dangerouslySetInnerHTML={{ __html: post.body }} />
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
          </div>

        </div>
      </main>
    </div>
  );
}
