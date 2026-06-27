import Link from 'next/link';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

function getAllBlogPosts() {
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
      author: data.author || 'SynthForce'
    };
  });
}

export default function BlogArchivePage() {
  const posts = getAllBlogPosts();

  return (
    <div className="bg-paper text-void font-sans">
      <main className="pb-20">
        <div className="bg-gray-50 border-b border-subtle py-20">
          <div className="max-w-3xl mx-auto px-6">
            <Link href="/blog" className="text-accent hover:underline text-sm mb-6 inline-block">
              &larr; Back to latest post
            </Link>
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
              All Published Posts
            </h1>
            <p className="text-xl text-gray-600">
              Archive of all SynthForce blog posts
            </p>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-6 py-16">
          {posts.length === 0 ? (
            <p className="text-gray-600">No posts yet.</p>
          ) : (
            <div className="space-y-6">
              {posts.map((post) => (
                <div key={post.slug} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 mb-2">
                        {post.title}
                      </h2>
                      <p className="text-sm text-gray-500">
                        {new Date(post.date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>
                  <p className="text-gray-600 mb-4">{post.excerpt}</p>
                  <a href={`/blog/${post.slug}`} className="text-accent hover:underline font-medium">
                    Read more &rarr;
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
