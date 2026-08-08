import {
  ArrowDown,
  Github,
  Linkedin,
  Mail,
  User,
  ChevronDown,
  Pointer,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

const typingWords = ["Dang Khoi Pham", "AI Engineering", "BackEnd Developer"];

const codeStrings = {
  javascript: `const developer = {
  role: "Full-Stack Developer",
  focus: ["Backend Development", "AI Engineering"],
  skills: [
    "Java Spring Boot Development",
    "FastAPI & Python Backend",
    "Database Design (PostgreSQL/MongoDB)"
  ],
  passion: [
    "AI & Machine Learning",
    "Backend Architecture",
    "Continuous Learning"
  ]
};`,
  python: `class Developer:
    def __init__(self):
        self.role = "Full-Stack Developer"
        self.focus = [
            "Backend Development",
            "AI Engineering"
        ]
        self.skills = [
            "Java Spring Boot Development",
            "FastAPI & Python Backend",
            "Database Design (PostgreSQL/MongoDB)"
        ]
        self.passion = [
            "AI & Machine Learning",
            "Backend Architecture", 
            "Continuous Learning"
        ]`,
  c: `struct Developer {
    char* role;
    char* focus[2];
    char* skills[3];
    char* passion[3];
};

struct Developer createDeveloper() {
    struct Developer dev;
    dev.role = "Full-Stack Developer";
    dev.focus[0] = "Backend Development";
    dev.focus[1] = "AI Engineering";
    dev.skills[0] = "Java Spring Boot Development";
    dev.skills[1] = "FastAPI & Python Backend";
    dev.skills[2] = "Database Design (PostgreSQL/MongoDB)";
    dev.passion[0] = "AI & Machine Learning";
    dev.passion[1] = "Backend Architecture";
    dev.passion[2] = "Continuous Learning";
    return dev;
}`,
  cpp: `class Developer {
private:
    string role;
    vector<string> focus;
    vector<string> skills;
    vector<string> passion;

public:
    Developer() {
        role = "Full-Stack Developer";
        focus = {
            "Backend Development",
            "AI Engineering"
        };
        skills = {
            "Java Spring Boot Development",
            "FastAPI & Python Backend",
            "Database Design (PostgreSQL/MongoDB)"
        };
        passion = {
            "AI & Machine Learning",
            "Backend Architecture",
            "Continuous Learning"
        };
    }
};`,
  java: `public class Developer {
    private String role;
    private String[] focus;
    private String[] skills;
    private String[] passion;

    public Developer() {
        this.role = "Full-Stack Developer";
        this.focus = new String[] {
            "Backend Development",
            "AI Engineering"
        };
        this.skills = new String[] {
            "Java Spring Boot Development",
            "FastAPI & Python Backend",
            "Database Design (PostgreSQL/MongoDB)"
        };
        this.passion = new String[] {
            "AI & Machine Learning",
            "Backend Architecture",
            "Continuous Learning"
        };
    }
}`,
};

type Language = keyof typeof codeStrings;

const languages: { value: Language; label: string }[] = [
  { value: "javascript", label: "JavaScript" },
  { value: "python", label: "Python" },
  { value: "c", label: "C" },
  { value: "cpp", label: "C++" },
  { value: "java", label: "Java" },
];

const MainSection = () => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
      },
    },
  };

  const scrollToProjects = () => {
    const projectsSection = document.getElementById("projects");
    if (projectsSection) {
      projectsSection.scrollIntoView({ behavior: "smooth" });
    }
  };

  const [wordIndex, setWordIndex] = useState(0);
  const [displayed, setDisplayed] = useState("");
  const [typing, setTyping] = useState(true);

  const [displayedCode, setDisplayedCode] = useState("");
  const [isTyping, setIsTyping] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentLanguage, setCurrentLanguage] =
    useState<Language>("javascript");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    let timeout: NodeJS.Timeout;

    if (isTyping) {
      if (currentIndex < codeStrings[currentLanguage].length) {
        timeout = setTimeout(() => {
          setDisplayedCode(
            (prev) => prev + codeStrings[currentLanguage][currentIndex]
          );
          setCurrentIndex((prev) => prev + 1);
        }, 30);
      } else {
        timeout = setTimeout(() => {
          setIsTyping(false);
        }, 2000);
      }
    } else {
      if (currentIndex > 0) {
        timeout = setTimeout(() => {
          setDisplayedCode((prev) => prev.slice(0, -1));
          setCurrentIndex((prev) => prev - 1);
        }, 15);
      } else {
        setIsTyping(true);
      }
    }

    return () => clearTimeout(timeout);
  }, [currentIndex, isTyping, currentLanguage]);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (typing) {
      if (displayed.length < typingWords[wordIndex].length) {
        timeout = setTimeout(() => {
          setDisplayed(typingWords[wordIndex].slice(0, displayed.length + 1));
        }, 80);
      } else {
        timeout = setTimeout(() => setTyping(false), 1200);
      }
    } else {
      if (displayed.length > 0) {
        timeout = setTimeout(() => {
          setDisplayed(displayed.slice(0, -1));
        }, 40);
      } else {
        setTyping(true);
        setWordIndex((prev) => (prev + 1) % typingWords.length);
      }
    }
    return () => clearTimeout(timeout);
  }, [displayed, typing, wordIndex]);

  const handleLanguageChange = (lang: Language) => {
    setCurrentLanguage(lang);
    setDisplayedCode("");
    setCurrentIndex(0);
    setIsTyping(true);
    setIsDropdownOpen(false);
  };

  return (
    <section
      id="/"
      className="relative min-h-screen flex flex-col items-center justify-center px-4 overflow-hidden pt-20"
    >
      <motion.div
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        className="container max-w-4xl mx-auto text-center z-10 mt-16"
      >
        <motion.div variants={itemVariants} className="space-y-8">
          <motion.h1 className="text-2xl sm:text-4xl md:text-6xl font-bold tracking-tight font-mono flex flex-wrap items-center justify-center gap-x-3 gap-y-2 md:gap-4">
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
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
                <User className="h-8 w-8 text-primary" />
              </motion.div>
            </motion.div>
            <span className="inline-block">Hi,</span>{" "}
            <span className="inline-block">I'm&nbsp;</span>
            {/* min-w reserves room so the typewriter does not reflow the line on every
                keystroke — but 16ch of mono type overflows a phone, so only reserve it
                once there is room for it. */}
            <span className="bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent sm:min-w-[16ch] h-[1.2em] flex items-center relative whitespace-nowrap">
              {displayed}
              <span className="inline-block animate-pulse">|</span>
              <span className="absolute -bottom-1 left-0 w-full h-[2px] bg-gradient-to-r from-primary/60 via-primary to-primary/60 rounded-full"></span>
            </span>
          </motion.h1>

          <motion.div
            className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed font-mono"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <div className="bg-background/50 backdrop-blur-sm p-6 rounded-xl border border-foreground/10 relative group">
              <div className="absolute top-3 left-3 flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/50 group-hover:bg-red-500 transition-colors"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500/50 group-hover:bg-yellow-500 transition-colors"></div>
                <div className="w-3 h-3 rounded-full bg-green-500/50 group-hover:bg-green-500 transition-colors"></div>
              </div>
              <div className="absolute top-3 right-3">
                <div className="relative">
                  <AnimatePresence>
                    {!isDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.5 }}
                        className="absolute -right-12 -top-2"
                      >
                        <motion.div
                          animate={{
                            y: [0, 10, 0],
                            rotate: [0, -10, 0],
                          }}
                          transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            repeatType: "reverse",
                            ease: "easeInOut",
                          }}
                          className="flex flex-col items-center"
                        >
                          <Pointer className="h-6 w-6 text-primary -rotate-45" />
                          <span className="text-xs text-primary mt-1">
                            Try me!
                          </span>
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <button
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="flex items-center gap-2 px-3 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors text-sm text-primary"
                  >
                    {
                      languages.find((lang) => lang.value === currentLanguage)
                        ?.label
                    }
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${
                        isDropdownOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  <AnimatePresence>
                    {isDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute right-0 mt-2 w-40 bg-background/95 backdrop-blur-sm border border-foreground/10 rounded-lg shadow-lg overflow-hidden z-50"
                      >
                        {languages.map((lang) => (
                          <button
                            key={lang.value}
                            onClick={() => handleLanguageChange(lang.value)}
                            className={`w-full px-4 py-2 text-left text-sm hover:bg-primary/10 transition-colors ${
                              currentLanguage === lang.value
                                ? "text-primary"
                                : "text-muted-foreground"
                            }`}
                          >
                            {lang.label}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
              <pre className="text-left whitespace-pre-wrap mt-6">
                <code className={`language-${currentLanguage}`}>
                  {displayedCode}
                  <span className="inline-block animate-pulse">|</span>
                </code>
              </pre>
            </div>
          </motion.div>

          <motion.div className="flex flex-col sm:flex-row gap-6 justify-center items-center pt-8">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={scrollToProjects}
              className="cosmic-button group relative overflow-hidden"
            >
              <span className="relative z-10">View My Work</span>
              <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </motion.button>

            <div className="flex gap-4">
              <motion.a
                whileHover={{ scale: 1.1, y: -5 }}
                href="https://github.com/dangkhoipham80"
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 rounded-xl bg-primary/10 hover:bg-primary/20 transition-all duration-300"
              >
                <Github className="h-6 w-6 text-primary" />
              </motion.a>
              <motion.a
                whileHover={{ scale: 1.1, y: -5 }}
                href="https://linkedin.com/in/dangkhoipham80"
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 rounded-xl bg-primary/10 hover:bg-primary/20 transition-all duration-300"
              >
                <Linkedin className="h-6 w-6 text-primary" />
              </motion.a>
              <motion.a
                whileHover={{ scale: 1.1, y: -5 }}
                href="mailto:dangkhoipham80@gmail.com"
                className="p-3 rounded-xl bg-primary/10 hover:bg-primary/20 transition-all duration-300"
              >
                <Mail className="h-6 w-6 text-primary" />
              </motion.a>
            </div>
          </motion.div>

          <motion.div className="flex flex-col items-center mt-10 mb-4">
            <motion.div
              animate={{
                y: [0, 10, 0],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                repeatType: "reverse",
                ease: "easeInOut",
              }}
              className="flex flex-col items-center"
            >
              <span className="text-sm text-muted-foreground mb-2">Scroll</span>
              <ArrowDown className="h-5 w-5 text-primary animate-bounce" />
            </motion.div>
          </motion.div>
        </motion.div>
      </motion.div>
    </section>
  );
};

export default MainSection;
