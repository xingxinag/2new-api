package controller

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// ===================== 公开验证接口 =====================

// VerifyInvitationCode 校验邀请码是否有效（invitation_codes 表）
// POST /api/invitation/verify
func VerifyInvitationCode(c *gin.Context) {
	var req struct {
		Code string `json:"code"`
	}
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "参数错误"})
		return
	}
	code := strings.TrimSpace(req.Code)
	if code == "" {
		c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"valid": false, "error_code": "empty", "error_msg": "请输入邀请码"}})
		return
	}
	result := model.ValidateInvitationCode(code)
	c.JSON(http.StatusOK, gin.H{"success": true, "data": result})
}

// VerifyRedemptionCode 校验兑换码是否有效
// POST /api/redemption/verify
func VerifyRedemptionCode(c *gin.Context) {
	var req struct {
		Key string `json:"key"`
	}
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "参数错误"})
		return
	}
	key := strings.TrimSpace(req.Key)
	if key == "" {
		c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"valid": false}})
		return
	}
	// 查兑换码是否存在且状态为启用
	var redemption model.Redemption
	err := model.DB.Where("`key` = ? AND deleted_at IS NULL AND status = ?", key, common.RedemptionCodeStatusEnabled).First(&redemption).Error
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"valid": false}})
		return
	}
	if redemption.ExpiredTime != 0 && redemption.ExpiredTime < common.GetTimestamp() {
		c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"valid": false}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"valid": true}})
}

// ===================== 管理员 CRUD =====================

func GetAllInvitationCodes(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	codes, total, err := model.GetAllInvitationCodes(pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(codes)
	common.ApiSuccess(c, pageInfo)
}

func SearchInvitationCodes(c *gin.Context) {
	keyword := c.Query("keyword")
	pageInfo := common.GetPageQuery(c)
	codes, total, err := model.SearchInvitationCodes(keyword, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(codes)
	common.ApiSuccess(c, pageInfo)
}

func GetInvitationCode(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	code, err := model.GetInvitationCodeById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, code)
}

func AddInvitationCode(c *gin.Context) {
	var ic model.InvitationCode
	if err := c.ShouldBindJSON(&ic); err != nil {
		common.ApiError(c, err)
		return
	}
	// 未提供 code 时随机生成
	if strings.TrimSpace(ic.Code) == "" {
		ic.Code = model.GenerateInvitationCode()
	} else {
		ic.Code = strings.TrimSpace(strings.ToUpper(ic.Code))
		// 检查唯一性
		var count int64
		model.DB.Model(&model.InvitationCode{}).Where("code = ?", ic.Code).Count(&count)
		if count > 0 {
			common.ApiError(c, errors.New("邀请码已存在"))
			return
		}
	}
	userId := c.GetInt("id")
	ic.CreatedBy = userId
	ic.CreatedAt = common.GetTimestamp()
	ic.UpdatedAt = common.GetTimestamp()
	if err := ic.Insert(); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, ic)
}

func UpdateInvitationCode(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	existing, err := model.GetInvitationCodeById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var input model.InvitationCode
	if err := c.ShouldBindJSON(&input); err != nil {
		common.ApiError(c, err)
		return
	}
	// 更新字段
	if input.Code != "" {
		existing.Code = strings.TrimSpace(strings.ToUpper(input.Code))
	}
	existing.MaxUses = input.MaxUses
	existing.ExpiredAt = input.ExpiredAt
	existing.Status = input.Status
	existing.Remark = input.Remark
	existing.UpdatedAt = common.GetTimestamp()
	if err := existing.Update(); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, existing)
}

func DeleteInvitationCode(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	code, err := model.GetInvitationCodeById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := code.Delete(); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}
