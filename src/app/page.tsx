/* eslint-disable @next/next/no-img-element */
"use client";

import { MessageCircle, Play, Users, Video, Check } from "lucide-react";
import Link from "next/link";
import { useCallback } from "react";
import Particles from "react-particles";
import type { Engine } from "tsparticles-engine";
import { loadSlim } from "tsparticles-slim";
import { Icons } from "@/components/Icons";

export default function Component() {
  const particlesInit = useCallback(async (engine: Engine) => {
    await loadSlim(engine);
  }, []);

  return (
    <div className="flex flex-col min-h-[100dvh]">
      <Particles
        className="absolute inset-0 z-0"
        init={particlesInit}
        options={{
          background: {
            color: {
              value: "#f3f4f6",
            },
          },
          fpsLimit: 120,
          interactivity: {
            events: {
              onHover: {
                enable: true,
                mode: "repulse",
              },
              resize: true,
            },
            modes: {
              repulse: {
                distance: 100,
                duration: 0.4,
              },
            },
          },
          particles: {
            color: {
              value: "#6366f1",
            },
            links: {
              color: "#6366f1",
              distance: 150,
              enable: true,
              opacity: 0.5,
              width: 1,
            },
            move: {
              direction: "none",
              enable: true,
              outModes: {
                default: "bounce",
              },
              random: false,
              speed: 2,
              straight: false,
            },
            number: {
              density: {
                enable: true,
                area: 800,
              },
              value: 80,
            },
            opacity: {
              value: 0.5,
            },
            shape: {
              type: "circle",
            },
            size: {
              value: { min: 1, max: 5 },
            },
          },
          detectRetina: true,
        }}
      />
      <div className="relative z-10 flex flex-col min-h-[100dvh]">
        <header className="px-4 lg:px-6 h-14 flex items-center">
          <Link
            className="flex items-center text-indigo-500 justify-center"
            href="#"
          >
            <Icons.Logo className="h-6 w-6" />
            <span className="ml-2 text-lg font-semibold">Ushico</span>
          </Link>
        </header>
        <main className="flex-1">
          <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48">
            <div className="container px-4 md:px-6">
              <div className="grid gap-6 lg:grid-cols-[1fr_400px] lg:gap-12 xl:grid-cols-[1fr_600px]">
                <div className="flex flex-col justify-center space-y-4">
                  <div className="space-y-2">
                    <h1 className="text-3xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none text-indigo-500">
                      Watch Together, Chat Together
                    </h1>
                    <p className="max-w-[600px] text-gray-500 md:text-xl dark:text-gray-400">
                      Synchronize your viewing experience with friends. Watch
                      videos in perfect sync while chatting in real-time.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 min-[400px]:flex-row">
                    <Link href="/dashboard">
                      <button className="text-white h-10 px-4 py-2 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-indigo-500 hover:bg-indigo-600">
                        <Play className="mr-2 h-4 w-4" />
                        Start Watching
                      </button>
                    </Link>
                    <button className="h-10 px-4 py-2 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-indigo-50 border-indigo-500 text-indigo-500 hover:bg-indigo-200">
                      Learn More
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-center">
                  <div className="relative w-full">
                    <div className="relative aspect-video overflow-hidden rounded-xl border bg-background">
                      <div className="absolute inset-0">
                        <Icons.Logo className="h-[300px] aspect-video w-[600px] text-indigo-600" />
                        {/* <img
                          alt="Video player interface"
                          className="object-cover"
                          height="400"
                          src="/placeholder.svg"
                          style={{
                            aspectRatio: "16/9",
                          }}
                          width="600"
                        /> */}
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background/80 to-background/0 p-4">
                        <div className="flex items-center gap-4">
                          <div className="h-2 flex-1 rounded-full bg-indigo-200">
                            <div className="h-full w-1/3 rounded-full bg-indigo-500" />
                          </div>
                          <span className="text-sm">00:15 / 02:30</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
          <section
            id="features"
            className="w-full py-12 md:py-24 lg:py-32 bg-white"
          >
            <div className="container px-4 md:px-6">
              <h2 className="text-3xl font-bold tracking-tighter md:text-4xl text-center mb-12 text-indigo-500">
                Features
              </h2>
              <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
                <div className="flex flex-col items-center space-y-4 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-500">
                    <Video className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold">Perfect Synchronization</h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    Watch videos in perfect sync with your friends, no matter
                    where they are.
                  </p>
                </div>
                <div className="flex flex-col items-center space-y-4 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-500">
                    <MessageCircle className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold">Real-time Chat</h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    Chat with your friends while watching, share reactions, and
                    discuss in real-time.
                  </p>
                </div>
                <div className="flex flex-col items-center space-y-4 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-500">
                    <Users className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold">Easy Room Creation</h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    Create a room in seconds and invite your friends with a
                    simple link.
                  </p>
                </div>
              </div>
            </div>
          </section>
          <section
            id="pricing"
            className="w-full py-12 md:py-24 lg:py-32 bg-gray-50"
          >
            <div className="container px-4 md:px-6">
              <h2 className="text-3xl font-bold tracking-tighter md:text-4xl text-center mb-12 text-indigo-500">
                Pricing Plans
              </h2>
              <div className="grid gap-8 grid-cols-2">
                <div className="flex flex-col p-6 bg-white rounded-lg shadow-lg">
                  <h3 className="text-2xl font-bold text-center mb-4">Free</h3>
                  <p className="text-4xl font-bold text-center mb-4">
                    $0<span className="text-base font-normal">/month</span>
                  </p>
                  <ul className="space-y-2 mb-6">
                    <li className="flex items-center">
                      <Check className="text-green-500 mr-2 h-5 w-5" />
                      <span>Sync with up to 3 friends</span>
                    </li>
                    <li className="flex items-center">
                      <Check className="text-green-500 mr-2 h-5 w-5" />
                      <span>Basic chat features</span>
                    </li>
                  </ul>
                  <button className="mt-auto text-white h-10 px-4 py-2 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-indigo-500 hover:bg-indigo-600">
                    Get Started
                  </button>
                </div>
                <div className="flex flex-col p-6 bg-white rounded-lg shadow-lg border-2 border-indigo-500">
                  <h3 className="text-2xl font-bold text-center mb-4">
                    More friends
                  </h3>
                  <p className="text-4xl font-bold text-center mb-4">
                    $9.99<span className="text-base font-normal">/month</span>
                  </p>
                  <ul className="space-y-2 mb-6">
                    <li className="flex items-center">
                      <Check className="text-green-500 mr-2 h-5 w-5" />
                      <span>Sync with up to 10 friends</span>
                    </li>
                    <li className="flex items-center">
                      <Check className="text-green-500 mr-2 h-5 w-5" />
                      <span>Advanced chat features with reactions...</span>
                    </li>
                    {/* <li className="flex items-center">
                      <Check className="text-green-500 mr-2 h-5 w-5" />
                      <span>Ad-free experience</span>
                    </li> */}
                  </ul>
                  <button className="mt-auto text-white h-10 px-4 py-2 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-indigo-500 hover:bg-indigo-600">
                    Upgrade to Pro
                  </button>
                </div>
              </div>
            </div>
          </section>
          <section id="about" className="w-full py-12 md:py-24 lg:py-32">
            <div className="container px-4 md:px-6">
              <div className="flex flex-col items-center justify-center space-y-4 text-center">
                <div className="space-y-2">
                  <h2 className="text-3xl font-bold tracking-tighter md:text-4xl text-indigo-500">
                    Ready to Watch Together?
                  </h2>
                  <p className="max-w-[600px] text-gray-500 md:text-xl dark:text-gray-400">
                    Join thousands of users who are already enjoying
                    synchronized viewing experiences.
                  </p>
                </div>
                <div className="w-full max-w-sm space-y-2">
                  <div className="flex space-x-2">
                    <input
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                      placeholder="Enter your email"
                      type="email"
                    />
                    <button className="text-white h-10 px-4 py-2 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-indigo-500 hover:bg-indigo-600">
                      Get Started
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    By signing up, you agree to our{" "}
                    <Link
                      className="underline underline-offset-2 hover:text-indigo-500"
                      href="#"
                    >
                      Terms & Conditions
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          </section>
        </main>
        <footer className="flex flex-col gap-2 sm:flex-row py-6 w-full shrink-0 items-center px-4 md:px-6 border-t">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            © 2024 Ushico. All rights reserved.
          </p>
          <nav className="sm:ml-auto flex gap-4 sm:gap-6">
            <Link
              className="text-xs hover:underline underline-offset-4 hover:text-indigo-500"
              href="#"
            >
              Terms of Service
            </Link>
            <Link
              className="text-xs hover:underline underline-offset-4 hover:text-indigo-500"
              href="#"
            >
              Privacy
            </Link>
          </nav>
        </footer>
      </div>
    </div>
  );
}
