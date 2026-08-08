import { Briefcase, Code, Sparkles, UserCircle } from "lucide-react";
import { motion } from "framer-motion";

// The CV is deliberately NOT committed — it carries a personal phone number and a
// public git history is forever. It is hosted externally and pointed at via env.
// Locally it falls back to public/assets/, which is gitignored.
const CV_URL =
  import.meta.env.VITE_CV_URL || "/assets/CV_PhamDangKhoi_Internship.pdf";

const AboutMeSection = () => {
  return (
    <section id="about" className="py-24 px-4 relative overflow-hidden">
      <div className="container mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center mb-16"
        >
          <motion.h2 className="text-4xl md:text-5xl font-bold text-center relative flex items-center gap-4">
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              whileInView={{ scale: 1, rotate: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, type: "spring" }}
              className="relative"
            >
              <motion.div
                animate={{
                  boxShadow: [
                    "0 0 0 0 rgba(var(--primary), 0.4)",
                    "0 0 0 10px rgba(var(--primary), 0)",
                    "0 0 0 0 rgba(var(--primary), 0.4)",
                  ],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="p-3 rounded-full bg-primary/10"
              >
                <UserCircle className="h-10 w-10 text-primary" />
              </motion.div>
            </motion.div>
            About{" "}
            <span className="text-primary relative inline-flex items-center gap-2">
              <Sparkles className="h-8 w-8 text-primary animate-pulse" />
              Me
              <span className="absolute -bottom-2 left-0 w-full h-1 bg-primary/30 rounded-full"></span>
            </span>
          </motion.h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="space-y-8"
          >
            <h3 className="text-2xl md:text-3xl font-semibold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Passionate Web Developer & Data/AI Engineer
            </h3>

            <div className="space-y-6">
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="text-muted-foreground leading-relaxed"
              >
                As a 3rd-year student at FPT University, I'm passionate about
                web development with a strong foundation in backend
                technologies. However, I'm now shifting my focus toward Data/AI
                Engineering, combining my backend knowledge with new skills in
                data science, machine learning, and artificial intelligence.
              </motion.p>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="text-muted-foreground leading-relaxed"
              >
                I specialize in creating scalable, efficient, and secure backend
                systems, and now I'm excited to dive deeper into the world of
                data, exploring how machine learning and AI can transform
                industries and solve complex problems. Constantly learning and
                evolving, I aim to merge my technical expertise with a keen
                interest in the future of data-driven technologies.
              </motion.p>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="flex flex-col sm:flex-row gap-6 pt-6 justify-center"
            >
              <a
                href="#contact"
                className="cosmic-button group relative overflow-hidden px-8 py-3 rounded-full bg-primary text-white hover:bg-primary/90 transition-all duration-300 transform hover:scale-105"
              >
                <span className="relative z-10">Get In Touch</span>
                <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </a>

              <a
                href={CV_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-3 rounded-full border-2 border-primary text-primary hover:bg-primary/10 transition-all duration-300 relative overflow-hidden group transform hover:scale-105"
              >
                <span className="relative z-10">Download CV</span>
                <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </a>
            </motion.div>
          </motion.div>

          <div className="grid grid-cols-1 gap-8">
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="gradient-border p-8 card-hover group hover:shadow-xl hover:shadow-primary/10"
            >
              <div className="flex items-start gap-6">
                <motion.div
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.5 }}
                  className="p-4 rounded-2xl bg-primary/10 group-hover:bg-primary/20 transition-colors duration-300"
                >
                  <Code className="h-7 w-7 text-primary" />
                </motion.div>
                <div className="text-left space-y-3">
                  <h4 className="font-semibold text-xl text-foreground">
                    Software Engineer
                  </h4>
                  <p className="text-muted-foreground leading-relaxed">
                    Building dynamic, scalable web applications with modern
                    technologies like React, Spring Boot, and RESTful APIs.
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="gradient-border p-8 card-hover group hover:shadow-xl hover:shadow-primary/10"
            >
              <div className="flex items-start gap-6">
                <motion.div
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.5 }}
                  className="p-4 rounded-2xl bg-primary/10 group-hover:bg-primary/20 transition-colors duration-300"
                >
                  <UserCircle className="h-7 w-7 text-primary" />
                </motion.div>
                <div className="text-left space-y-3">
                  <h4 className="font-semibold text-xl text-foreground">
                    Back-End Developer
                  </h4>
                  <p className="text-muted-foreground leading-relaxed">
                    Specializing in server-side development with technologies
                    like Java, Spring Boot, and database management to build
                    secure, scalable systems.
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.4 }}
              className="gradient-border p-8 card-hover group hover:shadow-xl hover:shadow-primary/10"
            >
              <div className="flex items-start gap-6">
                <motion.div
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.5 }}
                  className="p-4 rounded-2xl bg-primary/10 group-hover:bg-primary/20 transition-colors duration-300"
                >
                  <Briefcase className="h-7 w-7 text-primary" />
                </motion.div>
                <div className="text-left space-y-3">
                  <h4 className="font-semibold text-xl text-foreground">
                    Data/AI Engineer
                  </h4>
                  <p className="text-muted-foreground leading-relaxed">
                    Transitioning into Data Science and AI, exploring machine
                    learning, data analytics, and artificial intelligence to
                    solve complex problems.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutMeSection;
