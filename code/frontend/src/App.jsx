import { useEffect, useState, useRef } from "react";
import "./App.css";
import io from "socket.io-client";
import Editor from "@monaco-editor/react";
import { v4 as uuid } from "uuid";
import Avatar from "react-avatar";
import Split from "react-split";

const socket = io("http://localhost:5000");

// 🔹 Language → Version Map
const languageVersions = {
  javascript: "18.15.0",
  python: "3.10.0",
  java: "15.0.2",
  cpp: "10.2.0",
};

const App = () => {
  const [joined, setJoined] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [userName, setUserName] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [code, setCode] = useState("// start code here");
  const [users, setUsers] = useState([]);
  const [typing, setTyping] = useState("");
  const [outPut, setOutPut] = useState("");
  const [userInput, setUserInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copySuccess, setCopySuccess] = useState("");
  const outputRef = useRef(null);

  useEffect(() => {
    socket.on("userJoined", setUsers);
    socket.on("codeUpdate", setCode);
    socket.on("userTyping", (user) => {
      setTyping(`${user} is typing...`);
      setTimeout(() => setTyping(""), 2000);
    });
    socket.on("languageUpdate", setLanguage);
    socket.on("codeResponse", (response) => {
      setLoading(false);
      setOutPut(response.run?.output || response.run?.stderr || "No output");
    });

    return () => {
      socket.off("userJoined");
      socket.off("codeUpdate");
      socket.off("userTyping");
      socket.off("languageUpdate");
      socket.off("codeResponse");
    };
  }, []);

  useEffect(() => {
    const handleBeforeUnload = () => socket.emit("leaveRoom");
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const joinRoom = () => {
    if (!roomId || !userName) return alert("Enter Room ID and Name");
    socket.emit("join", { roomId, userName });
    setJoined(true);
  };

  const leaveRoom = () => {
    socket.emit("leaveRoom");
    setJoined(false);
    setRoomId("");
    setUserName("");
    setCode("// start code here");
    setLanguage("javascript");
    setOutPut("");
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setCopySuccess("Copied!");
    setTimeout(() => setCopySuccess(""), 2000);
  };

  const handleCodeChange = (newCode) => {
    setCode(newCode);
    socket.emit("codeChange", { roomId, code: newCode });
    socket.emit("typing", { roomId, userName });
  };

  const handleLanguageChange = (e) => {
    const newLang = e.target.value;
    setLanguage(newLang);
    socket.emit("languageChange", { roomId, language: newLang });
  };

  const runCode = () => {
    setLoading(true);
    socket.emit("compileCode", {
      code,
      roomId,
      language,
      version: languageVersions[language], // ✅ Added version
      input: userInput,
    });
  };

  const createRoomId = () => setRoomId(uuid());

  useEffect(() => {
    if (outputRef.current)
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [outPut]);

  if (!joined)
    return (
      <div className="join-container">
        <div className="join-form">
          <h1>Welcome To Code Neu</h1>
          <h3>Join Room</h3>
          <input
            type="text"
            placeholder="Room Id"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          />
          <button className="run-btn" onClick={createRoomId}>
            Create ID
          </button>
          <input
            type="text"
            placeholder="Your Name"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
          />
          <button className="run-btn" onClick={joinRoom}>
            Join Room
          </button>
        <h3>Made with 💛 by Anand </h3>
        </div>
      </div>
    );

  return (
    <div className="main-container">
      <Split
        className="split-container"
        sizes={[20, 80]}
        minSize={150}
        gutterSize={6}
        direction="horizontal"
      >
        <div className="sidebar">
          <div className="room-info">
            <button className="copy-button" onClick={copyRoomId}>
              COPY ID
            </button>
            {copySuccess && <span className="copy-success">{copySuccess}</span>}
          </div>
          <h3>Room Members</h3>
          <ul>
            {users.map((user, index) => (
              <li key={index} className="user-item">
                <Avatar name={user} size="30" round textSizeRatio={2} />
                <span className="user-name">{user}</span>
              </li>
            ))}
          </ul>
          <p className="typing-indicator">{typing}</p>
          <select
            className="language-selector"
            value={language}
            onChange={handleLanguageChange}
          >
            <option value="javascript">JavaScript</option>
            <option value="python">Python</option>
            <option value="java">Java</option>
            <option value="cpp">C++</option>
          </select>
          <button className="leave-button" onClick={leaveRoom}>
            Leave Room
          </button>
        </div>

        <Split
          className="split-vertical"
          sizes={[60, 40]}
          minSize={100}
          gutterSize={6}
          direction="vertical"
        >
          <div className="editor-wrapper">
           

            <Editor
              height="100%"
              language={language} // javascript / python / java / cpp
              value={code}
              onChange={handleCodeChange}
              theme="vs-dark"
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                quickSuggestions: true,
                suggestOnTriggerCharacters: true,
                parameterHints: { enabled: true },
                wordBasedSuggestions: true,
              }}
            />
          </div>
          <div className="console-wrapper">
            <textarea
              className="input-console"
              placeholder="Enter input here..."
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
            />
            <button className="run-btn execute-btn" onClick={runCode}>
              {loading ? "Running..." : "Execute"}
            </button>
            <textarea
              className="output-console"
              value={outPut}
              readOnly
              ref={outputRef}
              placeholder="Output will appear here..."
            />
          </div>
        </Split>
      </Split>
    </div>
  );
};

export default App;
