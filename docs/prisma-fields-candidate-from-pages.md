# Pages 反推 Prisma 字段补充清单（采纳版）

本文档已按你最新决策更新，以下为“确定采纳”的落库项和约束。

## 1) Tournament（赛事）采纳项

### 新增字段
- `Status String @default("REGISTRATION")`
- `Format String?`
- `PrizePool String?`
- `Description String?`
- `CurrentTeams Int @default(0)`

### 约束（必须满足）
- `CurrentTeams` 必须与 `SignUp` 聚合结果一致（同事务更新，禁止异步补偿造成延迟不一致）。
- 推荐做法：
  - 报名成功：`SignUp` 插入与 `Tournament.CurrentTeams + 1` 放在同一事务。
  - 取消报名/踢队：`SignUp` 删除与 `Tournament.CurrentTeams - 1` 放在同一事务。
  - 定期校验任务可选：用 `SignUp` 聚合做巡检，发现偏差时修正并写 `AdminLog`。

---

## 2) MatchInfo（比赛）采纳项

### 新增字段
- `MatchType String`（`H2H` / `LOBBY`）
- `MatchTime DateTime?`

### 明确不加
- 不加 `RoundLabel`（轮次统一写入 `MatchName`）
- 不加赛果锁定时间字段（赛果锁定时写 `AdminLog`）
- 不加摘要字段
- 不加“等待处理”字段

---

## 3) MatchParticipation（比赛-队伍参与）采纳项

### 新增字段
- `IsWinner Boolean?`

### 其他说明
- `Score` / `FinalRank` / `Status` 均保持现状不改。
- 前端后续按该结构调整显示逻辑。

---

## 4) Team（队伍）采纳项

### 新增字段
- `DisbandedAt DateTime?`
- `CreatedAt DateTime @default(now())`

---

## 5) TeamRequest（申请/邀请）采纳项

### 新增字段
- `HandledAt DateTime?`
- `HandledBy String?`（FK -> `User.UserID`）

---

## 6) MatchProposal（约赛提案）采纳项

### 新增字段
- `ResponderActionAt DateTime?`
- `Message String?`

### 明确不加
- 不加 `AcceptedTime`

### 业务落地规则（新增关联要求）
- 当双方确认时间后，该 `MatchProposal` 成为对应 `MatchInfo` 的“生效提案”。
- 需在 `MatchInfo` 上增加关联字段（例如 `ConfirmedProposalID String?`）指向生效 proposal。
- proposal 中被确认的时间写回 `MatchInfo.MatchTime`。

---

## 7) Game（项目）采纳项

### 新增字段
- `GameType String?`（`H2H` / `LOBBY` / `HYBRID`）
- `IsActive Boolean @default(true)`

---

## 8) AdminLog（管理员日志）采纳项

### 新增字段
- `Module String?`（如 `TOURNAMENT` / `MATCH` / `TEAM` / `GAME`）

### 额外约束
- 赛果锁定时，必须写 `AdminLog`（不再通过 `MatchInfo` 字段存锁定时间）。

---

## 9) 基于本次采纳后的重命名建议

你说“根据采纳情况再考虑重命名”，按当前决策建议如下：

- `MatchInfo.FinalStartTime` -> `MatchTime`
  - 理由：已明确比赛时间统一存 `MatchTime`。
- `Tournament.MaxTeamSize` 可保留不改（前端继续映射 `maxTeams`）
  - 理由：这次重点不是字段语义冲突，改名收益有限。
- `MatchInfo.MatchName` 暂不重命名
  - 理由：你已决定将 round 信息并入 `MatchName`，字段语义可成立。

---

## 10) 下一步建模执行顺序（建议）

按风险从低到高：
- 第 1 批：`Tournament`、`Game`、`Team`、`TeamRequest`、`AdminLog` 新增字段。
- 第 2 批：`MatchInfo` 的 `MatchType` + `MatchTime` + proposal 关联字段。
- 第 3 批：`MatchParticipation.IsWinner`。
- 第 4 批：接口事务化改造，确保 `CurrentTeams` 与 `SignUp` 强一致。
