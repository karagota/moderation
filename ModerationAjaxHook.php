<?php

/*
	Extension:Moderation - MediaWiki extension.
	Copyright (C) 2016-2024 Edward Chernenko.

	This program is free software; you can redistribute it and/or modify
	it under the terms of the GNU General Public License as published by
	the Free Software Foundation; either version 3 of the License, or
	(at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU General Public License for more details.
*/

/**
 * @file
 * Adds ajaxhook-related JavaScript modules when they are needed
 * (when MobileFrontend and/or VisualEditor extensions are installed and used).
 */

namespace MediaWiki\Moderation;

use MediaWiki\MediaWikiServices;
use OutputPage;
use UploadStashFile;
use RequestContext;


class ModerationAjaxHook {
	/**
	 * Add needed modules to $out.
	 * @param OutputPage &$out
	 */
	public static function add( OutputPage &$out ) {
		$modules = [];
		$services = MediaWikiServices::getInstance();

		if ( $services->hasService( 'MobileFrontend.Context' ) &&
			$services->getService( 'MobileFrontend.Context' )->shouldDisplayMobileView()
		) {
			$modules[] = 'ext.moderation.mf.notify';
			$modules[] = 'ext.moderation.mf.preload33';

			$title = $out->getTitle();
			$preload = $services->getService( 'Moderation.Preload' );

			if ( !$title->exists() && $preload->findPendingEdit( $title ) ) {
				// This user has a pending revision in $title, but $title doesn't exist.
				// Non-existent pages have wgArticleId=0, and MobileFrontend won't even try
				// to load their text.
				// HACK: fake wgArticleId makes MobileFrontend think that this page exists.
				$out->addJsConfigVars( 'wgArticleId', -1 ); // Not 0 means "page exists"
			}
		}

		if ( class_exists( 'MediaWiki\Extension\VisualEditor\ApiVisualEditorEdit' ) ) {
			$modules[] = 'ext.moderation.ve';
		}

		if ( $modules ) {
			$modules[] = 'ext.moderation.ajaxhook';
			$out->addModules( $modules );
		}
	}

    /**
     * Хук UploadStashFile: после сохранения чанков во временный файл
     *
     * @param UploadStashFile $uploadStash API-модуль загрузки stash
     * @param User $user текущий пользователь
     * @param array &$props свойства загрузки, в т.ч. ['sessionKey','filename']
     * @param string &$error необязательный код ошибки
     * @return bool
     */
    public static function onUploadStashFile( $uploadStash, $user, array &$props, &$error ): bool
    {
        // Только для непропускающих пользователей
        if ( !$user->isAllowed( 'skip-moderation' ) ) {
            // Помечаем файл как ожидающий модерации
            $props['moderation'] = 'pending';
            // Сохраняем исходное имя для вставки ссылки
            $props['fileName'] = $props['filename'];

            // Формируем URL к временному файлу
            $stashUrlBase = $GLOBALS['wgUploadStash']['stashDirectoryURL'] ?? '/w/images/stash';
            $sessionKey = $props['sessionKey'];
            $props['moderationTempUrl'] = $stashUrlBase . '/' . $sessionKey;
        }
        // Возвращаем true, чтобы остальная логика работала как обычно
        return true;
    }



}
