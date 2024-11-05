import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { MenuIcon } from "lucide-react";

import { userQueryOptions } from "@/lib/query-options";

import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "./ui/sheet";

export function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const { data: user } = useQuery(userQueryOptions());
  return (
    <header className="sticky top-0 z-50 w-full border-border/40 bg-primary/95 backdrop-blur supports-[backdrop-filter]:bg-primary">
      <div className="container mx-auto flex items-center justify-between p-4">
        <div className="flex items-center space-x-4">
          <Link to="/" className="text-2xl font-bold">
            BetterNews
          </Link>
          <nav className="hidden items-center space-x-4 md:flex">
            <Link className="hover:underline">new</Link>
            <Link className="hover:underline">top</Link>
            <Link className="hover:underline">submit</Link>
          </nav>
        </div>
        <div className="hidden items-center space-x-4">
          {user ? (
            <>
              <span>{user}</span>
              <Button
                asChild
                size="sm"
                variant="secondary"
                className="bg-secondary-foreground text-primary-foreground hover:bg-secondary-foreground/70"
              >
                <a href="api/auth/logout">Logout</a>
              </Button>
            </>
          ) : (
            <Button
              asChild
              size="sm"
              variant="secondary"
              className="bg-secondary-foreground text-primary-foreground hover:bg-secondary-foreground/70"
            >
              <Link to="/login">Log in</Link>
            </Button>
          )}
        </div>
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button variant="secondary" size="icon" className="md:hidden">
              <MenuIcon className="size-6" />
            </Button>
          </SheetTrigger>
          <SheetContent className="mb-2">
            <SheetHeader>
              <SheetTitle>BetterNews</SheetTitle>
              <SheetDescription className="sr-only">Navigation</SheetDescription>
            </SheetHeader>
            <nav className="flex flex-col space-y-4">
              <Link className="hover:underline" onClick={() => setIsOpen(false)}>
                new
              </Link>
              <Link className="hover:underline" onClick={() => setIsOpen(false)}>
                top
              </Link>
              <Link className="hover:underline" onClick={() => setIsOpen(false)}>
                submit
              </Link>
              {user ? (
                <>
                  <span>user: {user}</span>
                  <Button
                    asChild
                    size="sm"
                    variant="secondary"
                    className="bg-secondary-foreground text-primary-foreground hover:bg-secondary-foreground/70"
                  >
                    <a href="api/auth/logout">Logout</a>
                  </Button>
                </>
              ) : (
                <Button
                  asChild
                  size="sm"
                  variant="secondary"
                  className="bg-secondary-foreground text-primary-foreground hover:bg-secondary-foreground/70"
                >
                  <Link to="/login" onClick={() => setIsOpen(false)}>
                    Log in
                  </Link>
                </Button>
              )}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
