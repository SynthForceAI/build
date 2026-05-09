import { SiteNav } from "@/components/ui/site-nav";

export default function AboutPage() {
  return (
    <>
      <SiteNav />

      <main className="pt-16 pb-20 container mx-auto px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="text-5xl font-bold text-gray-900 mb-6">About SynthForce</h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              We are building the HR platform for AI agents. Our team brings together expertise
              in labor relations, software engineering, and robotics research to create the
              management layer that the AI agent workforce needs.
            </p>
          </div>

          <div className="flex flex-col gap-12 max-w-3xl mx-auto">
            <div className="bg-white border border-subtle rounded-2xl p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-2xl font-bold">
                  SK
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Samarth Kambli</h2>
                  <p className="text-accent font-medium">Founder &amp; CEO</p>
                </div>
              </div>
              <p className="text-gray-600 leading-relaxed">
                Samarth is the Founder and CEO of SynthForce. He is currently a Master&rsquo;s
                student at Cornell University, where he is completing an accelerated dual-degree
                program earning both an MBA and a Master of Industrial and Labor Relations
                (MILR). With previous experience in an HR SaaS, Samarth is focused on bringing
                the rigor of traditional labor relations and performance management to the world
                of AI agents. He will spend Summer 2026 at Amazon as Sr. HRBP intern, where he
                plans to gain the necessary skills and knowledge to continue building
                SynthForce.
              </p>
            </div>

            <div className="bg-white border border-subtle rounded-2xl p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-2xl font-bold">
                  MG
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Matthew Gomez-Morales</h2>
                  <p className="text-accent font-medium">Founding Full-Stack Engineer</p>
                </div>
              </div>
              <p className="text-gray-600 leading-relaxed">
                Matthew is a Founding Full-Stack Engineer at SynthForce, bringing a strong
                foundation in both software development and cutting-edge research. A Computer
                Engineering student at Florida State University, he also serves as a Research
                Intern in the Optimal Robotics Lab under Dr. Christian Hubicki, where he works
                at the intersection of robotics and intelligent systems. His experience spanning
                research and industry gives him a unique perspective on building scalable,
                research-informed AI solutions.
              </p>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
