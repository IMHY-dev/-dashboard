#!/usr/bin/env node
/**
 * 로컬 워커 데몬
 *
 * GitHub DB를 폴링하여 pending + autoLevel:"auto" 태스크를 감지하고
 * 로컬에서 Agent를 실행한 뒤 결과를 GitHub DB + Slack 스레드에 반영합니다.
 *
 * 사용법:
 *   node worker.js              # 30초 간격 폴링 (기본)
 *   node worker.js --interval 10 # 10초 간격
 *   node worker.js --once        # 1회만 실행 후 종료
 *
 * 환경변수 (.env):
 *   GITHUB_TOKEN       — GitHub PAT (repo scope)
 *   SLACK_BOT_TOKEN    — Slack Bot Token (chat:write)
 *   ANTHROPIC_API_KEY  — Claude API Key (auto.js, create.py에 필요)
 *   WORXPHERE_ID       — 전자결재 ID (fill.js에 필요)
 *   WORXPHERE_PW       — 전자결재 PW (fill.js에 필요)
 */

require("dotenv").config();
const { execSync } = require("child_process");
const path = require("path");

// ─── 설정 ───

const REPO = "IMHY-dev/-dashboard";
const TASKS_FILE = "data/tasks.json";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

const WORKSPACE = __dirname;
const PLACEMENT_DIR = "C:\\Users\\ugin35\\Desktop\\Placement survey 자동화 revive";
const PPT_MAKER_DIR = path.join(WORKSPACE, "ppt-maker");

const POLL_INTERVAL = (() => {
  const idx = process.argv.indexOf("--interval");
  return idx >= 0 ? parseInt(process.argv[idx + 1], 10) * 1000 : 30_000;
})();
const ONCE = process.argv.includes("--once");

// ─── Agent 실행 설정 (agents/route.ts와 동일) ───

const AGENT_CONFIGS = {
  "regular/macro-update": {
    command: "python update_macro.py",
    cwd: WORKSPACE,
    description: "KOSIS → Macro Analysis 엑셀 업데이트",
  },
  "regular/placement-analysis": {
    command: "python run_placement_agent.py",
    cwd: PLACEMENT_DIR,
    description: "Placement Survey 파이프라인",
  },
  "fluid/ppt-translate": {
    command: "python ppt-translater/translate.py",
    cwd: WORKSPACE,
    description: "한글 PPT → 영문 PPT 번역",
  },
  "fluid/budget-draft": {
    command: "node auto.js",
    cwd: WORKSPACE,
    description: "NL → 전자결재 자동 입력",
  },
  "fluid/ppt-create": {
    command: "python create.py",
    cwd: PPT_MAKER_DIR,
    description: "맥락 → PPTX 생성",
  },
  "fluid/meeting-notes": {
    command: "python meeting-notes/summarize.py",
    cwd: WORKSPACE,
    description: "TXT → 구조화 요약",
  },
};

// classify에서 오는 topicFile (.md 포함)을 agent key로 변환
function resolveAgentKey(topicFile) {
  if (!topicFile) return null;
  // .md 제거
  const key = topicFile.replace(/\.md$/, "");
  return AGENT_CONFIGS[key] ? key : null;
}

// ─── GitHub API ───

async function ghGet(filePath) {
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/contents/${filePath}`,
    {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github.v3+json",
      },
      cache: "no-store",
    }
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub GET ${res.status}`);
  return res.json();
}

async function ghPut(filePath, content, sha, message) {
  const body = {
    message,
    content: Buffer.from(content).toString("base64"),
  };
  if (sha) body.sha = sha;

  const res = await fetch(
    `https://api.github.com/repos/${REPO}/contents/${filePath}`,
    {
      method: "PUT",
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`GitHub PUT ${res.status}: ${JSON.stringify(err)}`);
  }
}

async function getAllTasks() {
  const file = await ghGet(TASKS_FILE);
  if (!file) return { tasks: [], sha: null };
  const content = Buffer.from(file.content.replace(/\s/g, ""), "base64").toString("utf-8");
  return { tasks: JSON.parse(content), sha: file.sha };
}

async function patchTask(taskId, patch) {
  const file = await ghGet(TASKS_FILE);
  if (!file) return;
  const content = Buffer.from(file.content.replace(/\s/g, ""), "base64").toString("utf-8");
  const tasks = JSON.parse(content);
  const updated = tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t));
  await ghPut(TASKS_FILE, JSON.stringify(updated, null, 2), file.sha, `worker: ${taskId} ${patch.status || ""}`);
}

// ─── Slack API ───

async function postSlack(channel, text, threadTs) {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return;

  // channel이 채널명이면 ID로 변환 (간단 매핑)
  const channelMap = {
    "#section-전략추진실-all": "C08NNP1D3A9",
    "#section-전략추진실-창준님": "C0AJ265GP8W",
    "#wg-전략추진실": "C09L1LBK1GD",
    "#wg-사업성장팀x전략추진실": "C0AL18T5KU6",
  };
  const channelId = channelMap[channel] || channel;

  try {
    await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel: channelId,
        text,
        ...(threadTs ? { thread_ts: threadTs } : {}),
      }),
    });
  } catch (err) {
    console.error("[Slack] 메시지 전송 실패:", err.message);
  }
}

// ─── Agent 실행 ───

function buildCommand(agentKey, task) {
  const config = AGENT_CONFIGS[agentKey];
  let cmd = config.command;
  const msg = task.message || "";

  // Agent별 파라미터 처리
  switch (agentKey) {
    case "fluid/budget-draft":
      // NL 메시지를 인자로 전달
      cmd = `${cmd} "${msg.replace(/"/g, '\\"')}"`;
      break;

    case "regular/placement-analysis": {
      // 메시지에서 분기 추출 (예: 26Q1, 25Q4)
      const qMatch = msg.match(/(\d{2})[Qq](\d)/);
      if (qMatch) cmd = `${cmd} --quarter ${qMatch[1]}Q${qMatch[2]}`;
      break;
    }

    case "fluid/ppt-translate": {
      // 메시지에서 파일명 추출 시도 (없으면 input/ 폴더의 최신 파일)
      const fileMatch = msg.match(/[\w가-힣]+\.pptx/i);
      if (fileMatch) cmd = `${cmd} input/${fileMatch[0]}`;
      break;
    }

    case "fluid/ppt-create":
      // 단발 모드로 실행
      cmd = `${cmd} --input "${msg.replace(/"/g, '\\"')}" --output "output/result_${Date.now()}.pptx"`;
      break;

    case "fluid/meeting-notes": {
      const txtMatch = msg.match(/[\w가-힣]+\.txt/i);
      if (txtMatch) cmd = `${cmd} input/${txtMatch[0]}`;
      break;
    }
  }

  return { cmd, cwd: config.cwd };
}

function runCommand(cmd, cwd) {
  try {
    const stdout = execSync(cmd, {
      cwd,
      encoding: "utf-8",
      timeout: 300_000,
      env: { ...process.env, PYTHONUTF8: "1", PYTHONIOENCODING: "utf-8" },
    });
    return { success: true, stdout: stdout.slice(0, 2000), stderr: "" };
  } catch (err) {
    return {
      success: false,
      stdout: (err.stdout || "").slice(0, 2000),
      stderr: (err.stderr || err.message || "").slice(0, 500),
    };
  }
}

// ─── 메인 루프 ───

async function poll() {
  try {
    const { tasks } = await getAllTasks();

    // pending + autoLevel:"auto" + topicFile이 있는 태스크만
    const pendingAuto = tasks.filter(
      (t) => t.status === "pending" && t.autoLevel === "auto" && t.topicFile
    );

    if (pendingAuto.length === 0) return;

    console.log(`\n[${new Date().toLocaleTimeString("ko-KR")}] 대기 중인 auto 태스크 ${pendingAuto.length}개 발견`);

    for (const task of pendingAuto) {
      const agentKey = resolveAgentKey(task.topicFile);
      if (!agentKey) {
        console.log(`  ⏭ ${task.id}: 실행 가능한 Agent 없음 (${task.topicFile})`);
        continue;
      }

      const config = AGENT_CONFIGS[agentKey];
      console.log(`  ▶ ${task.id}: ${config.description}`);
      console.log(`    메시지: "${task.message.slice(0, 80)}"`);

      // 상태 → in_progress
      await patchTask(task.id, { status: "in_progress" });

      // Slack 알림
      if (task.slackTs && task.channel) {
        await postSlack(task.channel, `🔄 ${config.description} 실행 중...`, task.slackTs);
      }

      // 실행
      const { cmd, cwd } = buildCommand(agentKey, task);
      console.log(`    실행: ${cmd}`);
      const result = runCommand(cmd, cwd);

      if (result.success) {
        console.log(`  ✅ 완료`);
        await patchTask(task.id, { status: "done" });

        if (task.slackTs && task.channel) {
          const output = result.stdout
            ? `\n\`\`\`${result.stdout.slice(0, 400)}\`\`\``
            : "";
          await postSlack(
            task.channel,
            `✅ ${config.description} 완료!${output}`,
            task.slackTs
          );
        }
      } else {
        console.log(`  ❌ 실패: ${result.stderr.slice(0, 200)}`);
        // 실패 시 pending으로 되돌리지 않음 (무한 재시도 방지)
        await patchTask(task.id, { status: "pending" });

        if (task.slackTs && task.channel) {
          await postSlack(
            task.channel,
            `❌ ${config.description} 실패\n\`\`\`${result.stderr.slice(0, 300)}\`\`\``,
            task.slackTs
          );
        }
      }
    }
  } catch (err) {
    console.error(`[${new Date().toLocaleTimeString("ko-KR")}] 폴링 에러:`, err.message);
  }
}

async function main() {
  if (!GITHUB_TOKEN) {
    console.error("❌ .env에 GITHUB_TOKEN이 필요합니다.");
    process.exit(1);
  }

  console.log("═══════════════════════════════════════");
  console.log("  전략추진실 워커 데몬 v1.0");
  console.log("═══════════════════════════════════════");
  console.log(`  폴링 간격: ${POLL_INTERVAL / 1000}초`);
  console.log(`  GitHub 레포: ${REPO}`);
  console.log(`  워크스페이스: ${WORKSPACE}`);
  console.log(`  Slack: ${process.env.SLACK_BOT_TOKEN ? "✅ 연결됨" : "⚠️ 토큰 없음"}`);
  console.log("═══════════════════════════════════════\n");

  if (ONCE) {
    await poll();
    console.log("\n--once 모드: 종료합니다.");
    return;
  }

  // 즉시 1회 + 이후 interval
  await poll();
  setInterval(poll, POLL_INTERVAL);
  console.log(`폴링 시작 (${POLL_INTERVAL / 1000}초 간격)... Ctrl+C로 종료\n`);
}

main();
