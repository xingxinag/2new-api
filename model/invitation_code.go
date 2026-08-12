package model

import (
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

// InvitationCode 管理员创建的邀请码（独立于用户自身的 aff_code）
type InvitationCode struct {
	Id        int            `json:"id"`
	Code      string         `json:"code" gorm:"type:varchar(32);uniqueIndex;not null"`
	MaxUses   int            `json:"max_uses" gorm:"default:0"`              // 0=无限
	UsedCount int            `json:"used_count" gorm:"default:0"`
	ExpiredAt int64          `json:"expired_at" gorm:"bigint;default:0"`    // 0=永不过期
	Status    int            `json:"status" gorm:"default:1"`               // 1=启用 2=禁用
	CreatedBy int            `json:"created_by"`                            // 创建者管理员 ID
	Remark    string         `json:"remark" gorm:"size:255"`
	CreatedAt int64          `json:"created_at" gorm:"bigint"`
	UpdatedAt int64          `json:"updated_at" gorm:"bigint"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index"`
}

func (InvitationCode) TableName() string {
	return "invitation_codes"
}

// ValidateInvitationCodeResult 校验结果，含错误原因
type ValidateInvitationCodeResult struct {
	Valid     bool   `json:"valid"`
	ErrorCode string `json:"error_code,omitempty"` // not_found / disabled / expired / used_up
	ErrorMsg  string `json:"error_msg,omitempty"`
}

// ValidateInvitationCode 校验邀请码：存在、启用、未过期、未达上限、创建者为管理员
func ValidateInvitationCode(code string) ValidateInvitationCodeResult {
	code = strings.TrimSpace(code)
	if code == "" {
		return ValidateInvitationCodeResult{Valid: false, ErrorCode: "not_found", ErrorMsg: "邀请码为空"}
	}
	var ic InvitationCode
	err := DB.Where("code = ? AND deleted_at IS NULL", code).First(&ic).Error
	if err != nil {
		return ValidateInvitationCodeResult{Valid: false, ErrorCode: "not_found", ErrorMsg: "邀请码不存在"}
	}
	if ic.Status != 1 {
		return ValidateInvitationCodeResult{Valid: false, ErrorCode: "disabled", ErrorMsg: "邀请码已被禁用"}
	}
	if ic.ExpiredAt != 0 && ic.ExpiredAt < common.GetTimestamp() {
		return ValidateInvitationCodeResult{Valid: false, ErrorCode: "expired", ErrorMsg: "邀请码已过期"}
	}
	if ic.MaxUses > 0 && ic.UsedCount >= ic.MaxUses {
		return ValidateInvitationCodeResult{Valid: false, ErrorCode: "used_up", ErrorMsg: "邀请码已用完"}
	}
	// 检查创建者角色：必须是管理员或超级管理员
	if ic.CreatedBy > 0 {
		var creator User
		if err := DB.Select("role").Where("id = ?", ic.CreatedBy).First(&creator).Error; err != nil {
			return ValidateInvitationCodeResult{Valid: false, ErrorCode: "invalid_creator", ErrorMsg: "邀请码创建者无效"}
		}
		if creator.Role != common.RoleAdminUser && creator.Role != common.RoleRootUser {
			return ValidateInvitationCodeResult{Valid: false, ErrorCode: "non_admin_creator", ErrorMsg: "邀请码创建者必须是管理员"}
		}
	}
	return ValidateInvitationCodeResult{Valid: true}
}

// ConsumeInvitationCode 原子递增已用次数（CAS 方式）
func ConsumeInvitationCode(code string) error {
	code = strings.TrimSpace(code)
	keyCol := "`code`"
	if common.UsingMainDatabase(common.DatabaseTypePostgreSQL) {
		keyCol = `"code"`
	}
	common.RandomSleep()
	err := DB.Transaction(func(tx *gorm.DB) error {
		var ic InvitationCode
		err := lockForUpdate(tx).Where(keyCol+" = ? AND deleted_at IS NULL", code).First(&ic).Error
		if err != nil {
			return errors.New("邀请码无效")
		}
		if ic.Status != 1 {
			return errors.New("邀请码已被禁用")
		}
		if ic.ExpiredAt != 0 && ic.ExpiredAt < common.GetTimestamp() {
			return errors.New("邀请码已过期")
		}
		if ic.MaxUses > 0 && ic.UsedCount >= ic.MaxUses {
			return errors.New("邀请码已用完")
		}
		result := tx.Model(&InvitationCode{}).
			Where("id = ? AND deleted_at IS NULL", ic.Id).
			Update("used_count", gorm.Expr("used_count + 1"))
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return errors.New("邀请码消费失败")
		}
		return nil
	})
	if err != nil {
		common.SysError("consume invitation code failed: " + err.Error())
		return err
	}
	common.SysLog(fmt.Sprintf("邀请码 %s 已消耗", code))
	return nil
}

// GenerateInvitationCode 生成唯一随机邀请码
func GenerateInvitationCode() string {
	prefix := "INV-"
	for {
		code := prefix + strings.ToUpper(common.GetRandomString(8))
		var count int64
		DB.Model(&InvitationCode{}).Where("code = ? AND deleted_at IS NULL", code).Count(&count)
		if count == 0 {
			return code
		}
	}
}

// --- CRUD for admin API ---

func GetAllInvitationCodes(startIdx int, num int) (codes []*InvitationCode, total int64, err error) {
	tx := DB.Begin()
	if tx.Error != nil {
		return nil, 0, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	err = tx.Model(&InvitationCode{}).Count(&total).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	err = tx.Order("id desc").Limit(num).Offset(startIdx).Find(&codes).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	if err = tx.Commit().Error; err != nil {
		return nil, 0, err
	}
	return codes, total, nil
}

func SearchInvitationCodes(keyword string, startIdx int, num int) (codes []*InvitationCode, total int64, err error) {
	tx := DB.Begin()
	if tx.Error != nil {
		return nil, 0, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	query := tx.Model(&InvitationCode{})
	if keyword != "" {
		query = query.Where("code LIKE ? OR remark LIKE ?", "%"+keyword+"%", "%"+keyword+"%")
	}

	err = query.Count(&total).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	err = query.Order("id desc").Limit(num).Offset(startIdx).Find(&codes).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	if err = tx.Commit().Error; err != nil {
		return nil, 0, err
	}
	return codes, total, nil
}

func GetInvitationCodeById(id int) (*InvitationCode, error) {
	var code InvitationCode
	err := DB.Where("id = ? AND deleted_at IS NULL", id).First(&code).Error
	return &code, err
}

func (ic *InvitationCode) Insert() error {
	return DB.Create(ic).Error
}

func (ic *InvitationCode) Update() error {
	return DB.Model(ic).Updates(map[string]interface{}{
		"code":       ic.Code,
		"max_uses":   ic.MaxUses,
		"expired_at": ic.ExpiredAt,
		"status":     ic.Status,
		"remark":     ic.Remark,
	}).Error
}

func (ic *InvitationCode) Delete() error {
	return DB.Delete(ic).Error
}
