import { ArrowUp, Github, Linkedin, Mail } from "lucide-react";
import { motion } from "framer-motion";

const Footer = () => {
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <footer className="py-12 px-4 bg-card relative border-t border-border mt-12">
      <div className="container mx-auto max-w-5xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center mb-8">
          <div className="text-center md:text-left">
            <h3 className="text-lg font-semibold mb-2">Phạm Đăng Khôi</h3>
            <p className="text-sm text-muted-foreground">
              Full Stack Developer & Data/AI Engineer
            </p>
          </div>

          <div className="flex justify-center gap-6">
            <motion.a
              whileHover={{ scale: 1.1, y: -5 }}
              href="https://github.com/dangkhoipham80"
              target="_blank"
              rel="noopener noreferrer"
              className="p-3 rounded-xl bg-primary/10 hover:bg-primary/20 transition-all duration-300"
            >
              <Github className="h-5 w-5 text-primary" />
            </motion.a>
            <motion.a
              whileHover={{ scale: 1.1, y: -5 }}
              href="https://www.linkedin.com/in/khoipham4022/"
              target="_blank"
              rel="noopener noreferrer"
              className="p-3 rounded-xl bg-primary/10 hover:bg-primary/20 transition-all duration-300"
            >
              <Linkedin className="h-5 w-5 text-primary" />
            </motion.a>
            <motion.a
              whileHover={{ scale: 1.1, y: -5 }}
              href="mailto:dangkhoipham80@gmail.com"
              className="p-3 rounded-xl bg-primary/10 hover:bg-primary/20 transition-all duration-300"
            >
              <Mail className="h-5 w-5 text-primary" />
            </motion.a>
          </div>

          <div className="text-center md:text-right">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={scrollToTop}
              className="p-3 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary transition-all duration-300 group relative overflow-hidden"
            >
              <ArrowUp className="h-5 w-5 relative z-10" />
              <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </motion.button>
          </div>
        </div>

        <div className="border-t border-border pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground text-center md:text-left">
              &copy; {new Date().getFullYear()} Phạm Đăng Khôi. All rights
              reserved.
            </p>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <a href="#about" className="hover:text-primary transition-colors">
                About
              </a>
              <a
                href="#projects"
                className="hover:text-primary transition-colors"
              >
                Projects
              </a>
              <a
                href="#contact"
                className="hover:text-primary transition-colors"
              >
                Contact
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
