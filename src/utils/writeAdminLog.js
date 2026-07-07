// 管理员日志统一写入函数，避免重复拼装字段
const writeAdminLog = async (tx, { adminId, module, actionType, targetId, details }) => {
  return tx.adminLog.create({
    data: {
      AdminID: adminId || null,
      Module: module || null,
      ActionType: actionType,
      TargetID: targetId,
      Details: details
    }
  });
};

module.exports = writeAdminLog;
